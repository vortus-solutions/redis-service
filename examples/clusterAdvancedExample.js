// Advanced Redis Cluster Example
'use strict';

const { RedisService, LuaScriptService } = require('../src/index');

// Register a custom Lua script for use with the cluster
LuaScriptService.register('incrementAndGet', {
    numberOfKeys: 1,
    lua: `
        local current = tonumber(redis.call('GET', KEYS[1])) or 0
        current = current + 1
        redis.call('SET', KEYS[1], current)
        return current
    `
});

// Custom logger for detailed debugging
const clusterLogger = {
    info: (...args) => console.log('[Cluster Info]:', ...args),
    error: (...args) => console.error('[Cluster Error]:', ...args),
    debug: (...args) => console.debug('[Cluster Debug]:', ...args),
    warn: (...args) => console.warn('[Cluster Warn]:', ...args)
};

// Configure connection with advanced options
const createClusterConfig = (nodes) => ({
    nodes: nodes,
    keyPrefix: 'advanced-demo:',
    password: '12345', // In production, use environment variables
    showFriendlyErrorStack: true,
    enableOfflineQueue: true,
    connectTimeout: 10000,        // Connection timeout in ms
    maxRedirections: 16,          // Max number of redirections to follow for cluster commands
    retryDelayOnFailover: 200,    // Delay before retrying after a failover
    retryDelayOnClusterDown: 1000, // Delay before retrying when cluster reports CLUSTERDOWN
    enableAutoPipelining: true,   // Automatically use pipelining for better performance
    
    clusterRetryStrategy: (times) => {
        // Exponential backoff with a maximum of 5 seconds
        if (times > 10) {
            console.error('Too many connection attempts, giving up.');
            return null; // Stop retrying
        }
        return Math.min(Math.exp(times / 2) * 100, 5000);
    }
});

async function testLuaScript(redis) {
    try {
        console.log('Testing Lua script execution in cluster mode...');
        const key = 'counter';
        
        // Set initial value
        await redis.set(key, 0);
        
        // Execute the Lua script multiple times
        const results = [];
        for (let i = 0; i < 5; i++) {
            const result = await redis.incrementAndGet(key);
            results.push(result);
        }
        
        console.log(`Lua script results: ${results.join(', ')}`);
        const finalValue = await redis.get(key);
        console.log(`Final counter value: ${finalValue}`);
        
        return true;
    } catch (error) {
        console.error('Error executing Lua script:', error);
        return false;
    }
}

async function testClusterOperations() {
    // Setup nodes - use your actual Redis Cluster nodes
    const nodes = [
        { host: 'redis-001.vortus-redis-ha.svc.cluster.local', port: 6379 },
        { host: 'redis-002.vortus-redis-ha.svc.cluster.local', port: 6379 },
        { host: 'redis-003.vortus-redis-ha.svc.cluster.local', port: 6379 }
    ];
    
    // In a real application, you might set this up via environment variables
    // const nodes = process.env.REDIS_NODES.split(',').map(node => {
    //     const [host, port] = node.split(':');
    //     return { host, port: parseInt(port, 10) };
    // });
    
    try {
        console.log('Setting up Redis Cluster connection with advanced options...');
        RedisService.setupLogger(clusterLogger);
        
        // Register event listeners for better monitoring
        RedisService.on('connectionEstablished', name => {
            console.log(`Redis connection "${name}" established successfully`);
        });
        
        RedisService.on('connectionError', ({ connectionName, error }) => {
            console.error(`Redis connection "${connectionName}" error:`, error.message);
        });
        
        RedisService.on('connectionClosed', name => {
            console.log(`Redis connection "${name}" closed`);
        });
        
        // Create the connection with our custom Lua script
        console.log('Creating cluster connection...');
        const redis = await RedisService.createClusterConnection(
            'advancedCluster', 
            createClusterConfig(nodes), 
            ['incrementAndGet']
        );
        
        // Basic connection test
        await redis.set('test:key', 'Hello Cluster!');
        const value = await redis.get('test:key');
        console.log(`Basic test - Retrieved value: ${value}`);
        
        // Test pipeline operations
        console.log('\nTesting pipeline operations...');
        const pipeline = redis.pipeline();
        
        // Add several operations to the pipeline
        pipeline.set('{pipeline}:key1', 'value1');
        pipeline.set('{pipeline}:key2', 'value2');
        pipeline.set('{pipeline}:key3', 'value3');
        pipeline.get('{pipeline}:key1');
        pipeline.get('{pipeline}:key2');
        pipeline.get('{pipeline}:key3');
        
        const pipelineResults = await pipeline.exec();
        console.log('Pipeline results:', pipelineResults);
        
        // Test Lua script execution
        console.log('\nTesting Lua script execution...');
        await testLuaScript(redis);
        
        // Test error handling with an intentional error
        console.log('\nTesting error handling (intentional error)...');
        try {
            // Trying to use a transaction without pipeline in cluster mode (not supported)
            await redis.multi({ pipeline: false }).set('key', 'value').exec();
        } catch (err) {
            console.log('Expected error caught successfully:', err.message);
        }
        
        // Close the connection
        console.log('\nClosing all connections...');
        await RedisService.closeAll();
        console.log('All connections closed');
    } catch (error) {
        console.error('Cluster operations error:', error);
        if (error.stack) {
            console.error(error.stack);
        }
        
        // Always try to close connections even if there's an error
        try {
            await RedisService.closeAll();
            console.log('Connections closed after error');
        } catch (closeError) {
            console.error('Error closing connections:', closeError);
        }
        
        return false;
    }
    
    return true;
}

// Run the example
testClusterOperations()
    .then(success => {
        console.log('\nTest completed:', success ? 'Successfully!' : 'With errors.');
        return success; // Return result rather than exiting
    })
    .catch(err => {
        console.error('Unexpected error in test:', err);
        return false;
    });
