// Redis Multi-Node Connection Example
'use strict';

const RedisService = require('../src/redisService');

// Custom logger implementation for better cluster debugging
const clusterLogger = {
    info: (...args) => console.log('[Cluster Info]:', ...args),
    error: (...args) => console.error('[Cluster Error]:', ...args),
    debug: (...args) => console.debug('[Cluster Debug]:', ...args),
    warn: (...args) => console.warn('[Cluster Warn]:', ...args)
};

// Example configuration for cluster connection
const clusterConfig = {
    nodes: [
        { host: 'redis-001.vortus-redis-ha.svc.cluster.local', port: 6379 },
        { host: 'redis-002.vortus-redis-ha.svc.cluster.local', port: 6379 },
        { host: 'redis-003.vortus-redis-ha.svc.cluster.local', port: 6379 },
        { host: 'redis-004.vortus-redis-ha.svc.cluster.local', port: 6379 },
        { host: 'redis-005.vortus-redis-ha.svc.cluster.local', port: 6379 },
        { host: 'redis-006.vortus-redis-ha.svc.cluster.local', port: 6379 }
    ],
    keyPrefix: 'lib-demo:',
    password: '12345',
    showFriendlyErrorStack: true, // For better error messages
    enableOfflineQueue: true,
    logger: clusterLogger,
    // Cluster specific options
    clusterRetryStrategy: (times) => {
        return Math.min(times * 100, 2000); // Maximum 2 seconds delay
    },
    maxRedirections: 16, // Maximum number of redirections to follow for cluster commands
};

async function runExample() {
    try {
        console.log('Setting up custom logger...');
        RedisService.setupLogger(clusterLogger);
        
        // Set up event listeners
        RedisService.on('connectionAttempt', ({ connectionName }) => {
            console.log(`Attempting to connect to Redis cluster as ${connectionName}...`);
        });
        
        RedisService.on('connectionEstablished', (name) => {
            console.log(`Connection ${name} established successfully.`);
        });
        
        RedisService.on('connectionError', ({ connectionName, error }) => {
            console.error(`Connection ${connectionName} encountered an error:`, error);
        });
        
        // Create cluster connection
        console.log('Creating cluster connection...');
        const clusterConnection = await RedisService.createClusterConnection(
            'clusterInstance',
            clusterConfig,
            []
        );
        
        console.log('Cluster connection established');
        
        // Run a basic test
        console.log('Testing set operation...');
        await clusterConnection.set('testKey', 'clusterValue');
        
        console.log('Testing get operation...');
        const clusterValue = await clusterConnection.get('testKey');
        console.log('Cluster value:', clusterValue);
        
        // Test pipeline - in cluster mode, all keys in a pipeline must map to the same slot
        // We use the same key hash tag {tag} to ensure they go to the same node
        console.log('Testing pipeline...');
        const pipeline = clusterConnection.pipeline();
        pipeline.set('pipeline:{test}:key1', 'value1');
        pipeline.set('pipeline:{test}:key2', 'value2');
        pipeline.get('pipeline:{test}:key1');
        pipeline.get('pipeline:{test}:key2');
        
        const pipelineResults = await pipeline.exec();
        console.log('Pipeline results:', pipelineResults);
        
        // Close connections
        console.log('Closing all connections...');
        await RedisService.closeAll();
        console.log('All connections closed');
    } catch (error) {
        console.error('Error in example:', error);
        // Display the full error details
        if (error.stack) {
            console.error(error.stack);
        }
        throw error; // Throw instead of exiting directly
    }
}

// Run the example
runExample()
    .catch(error => {
        console.error('Fatal error:', error.message);
    });
