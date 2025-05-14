// Redis Cluster Connection Test Utility
'use strict';

const Redis = require('ioredis');
const RedisService = require('../src/redisService');

// Configurable options
const DEFAULT_TIMEOUT = 5000; // 5 seconds
let testTimeout = DEFAULT_TIMEOUT;

// Helper function to create consistent log messages
const logMsg = (level, message) => {
    const timestamp = new Date().toISOString();
    switch (level.toLowerCase()) {
        case 'info':
            console.log(`[${timestamp}] [INFO] ${message}`);
            break;
        case 'error':
            console.error(`[${timestamp}] [ERROR] ${message}`);
            break;
        case 'warn':
            console.warn(`[${timestamp}] [WARN] ${message}`);
            break;
        case 'success':
            console.log(`[${timestamp}] [SUCCESS] ${message}`);
            break;
        default:
            console.log(`[${timestamp}] ${message}`);
    }
};

// Directly test ioredis Cluster connection
async function testDirectClusterConnection(nodes, options = {}) {
    logMsg('info', 'Testing direct ioredis Cluster connection...');
    
    try {
        const startTime = Date.now();
        
        const cluster = new Redis.Cluster(nodes, {
            redisOptions: {
                password: options.password,
                connectTimeout: testTimeout,
                ...options
            },
            ...options
        });
        
        // Listen for errors
        cluster.on('error', (err) => {
            logMsg('error', `Cluster error event: ${err.message}`);
        });
        
        cluster.on('node error', (err, node) => {
            logMsg('error', `Node error event from ${node}: ${err.message}`);
        });
        
        // Create a promise that resolves on successful connection
        const connectionPromise = new Promise((resolve, reject) => {
            cluster.on('ready', () => {
                const elapsed = Date.now() - startTime;
                logMsg('success', `Direct Cluster connection successful (${elapsed}ms)`);
                resolve(cluster);
            });
            
            setTimeout(() => {
                reject(new Error(`Connection timed out after ${testTimeout}ms`));
            }, testTimeout);
        });
        
        const connectedCluster = await connectionPromise;
        
        // Test simple operations
        const ping = await connectedCluster.ping();
        logMsg('success', `PING response: ${ping}`);
        
        const infoResults = await connectedCluster.info();
        logMsg('info', 'INFO command successful');
        
        // Clean up
        await connectedCluster.quit();
        logMsg('info', 'Connection closed properly');
        
        return true;
    } catch (error) {
        logMsg('error', `Direct cluster connection failed: ${error.message}`);
        if (error.stack) {
            console.error(error.stack);
        }
        return false;
    }
}

// Test RedisService Cluster connection
async function testServiceClusterConnection(nodes, options = {}) {
    logMsg('info', 'Testing RedisService Cluster connection...');
    
    try {
        const startTime = Date.now();
        
        // Configure event listeners
        RedisService.on('connectionEstablished', (name) => {
            const elapsed = Date.now() - startTime;
            logMsg('success', `Service connection "${name}" established (${elapsed}ms)`);
        });
        
        RedisService.on('connectionError', ({ connectionName, error }) => {
            logMsg('error', `Service connection "${connectionName}" error: ${error.message}`);
        });
        
        const clusterConnection = await RedisService.createClusterConnection(
            'testClusterConn',
            {
                nodes,
                connectTimeout: testTimeout,
                ...options
            },
            []
        );
        
        // Test simple operations
        const ping = await clusterConnection.ping();
        logMsg('success', `PING response: ${ping}`);
        
        const infoResults = await clusterConnection.info();
        logMsg('info', 'INFO command successful');
        
        // Clean up
        await RedisService.closeAll();
        logMsg('info', 'Connections closed properly');
        
        return true;
    } catch (error) {
        logMsg('error', `Service cluster connection failed: ${error.message}`);
        if (error.stack) {
            console.error(error.stack);
        }
        
        try {
            await RedisService.closeAll();
        } catch (closeError) {
            logMsg('error', `Error closing connections: ${closeError.message}`);
        }
        
        return false;
    }
}

// Function to validate cluster nodes and topology
async function validateClusterTopology(nodes, options = {}) {
    logMsg('info', 'Validating cluster topology...');
    
    try {
        // Connect to first node to get cluster info
        const singleNode = new Redis({
            host: nodes[0].host,
            port: nodes[0].port,
            password: options.password,
            connectTimeout: testTimeout,
            ...options
        });
        
        // Get cluster info
        const clusterInfo = await singleNode.cluster('INFO');
        logMsg('info', 'Cluster info retrieved');
        
        // Parse cluster info response
        const infoLines = clusterInfo.split('\n');
        const clusterState = {};
        
        infoLines.forEach(line => {
            if (line.includes(':')) {
                const [key, value] = line.split(':');
                clusterState[key.trim()] = value.trim();
            }
        });
        
        if (clusterState['cluster_state'] !== 'ok') {
            logMsg('error', `Cluster state is not OK: ${clusterState['cluster_state']}`);
        } else {
            logMsg('success', `Cluster state: ${clusterState['cluster_state']}`);
            logMsg('info', `Cluster size: ${clusterState['cluster_size']} nodes`);
            logMsg('info', `Cluster slots assigned: ${clusterState['cluster_slots_assigned']}`);
            logMsg('info', `Cluster slots OK: ${clusterState['cluster_slots_ok']}`);
        }
        
        // Get nodes info
        const nodesInfo = await singleNode.cluster('NODES');
        const nodeLines = nodesInfo.split('\n').filter(Boolean);
        
        logMsg('info', `Cluster has ${nodeLines.length} nodes defined`);
        
        // Parse and display node info
        const parsedNodes = nodeLines.map(line => {
            const parts = line.split(' ');
            const id = parts[0];
            const addrParts = parts[1].split('@')[0].split(':');
            const flags = parts[2].split(',');
            
            return {
                id,
                host: addrParts[0],
                port: addrParts[1],
                isMaster: !flags.includes('slave'),
                role: flags.includes('master') ? 'master' : 'slave',
                status: flags.includes('fail') ? 'failed' : 
                        flags.includes('handshake') ? 'handshake' : 'ok'
            };
        });
        
        // Display node information
        parsedNodes.forEach(node => {
            const status = node.status === 'ok' ? 'OK' : `PROBLEM: ${node.status}`;
            logMsg(node.status === 'ok' ? 'success' : 'error', 
                  `Node ${node.id.substring(0, 8)}... (${node.host}:${node.port}) - ${node.role} - ${status}`);
        });
        
        // Check if our nodes list matches the actual cluster nodes
        const providedHosts = new Set(nodes.map(n => `${n.host}:${n.port}`));
        const actualHosts = new Set(parsedNodes.map(n => `${n.host}:${n.port}`));
        
        let allFound = true;
        for (const provided of providedHosts) {
            if (!actualHosts.has(provided)) {
                logMsg('warn', `Node ${provided} provided in config but not found in cluster`);
                allFound = false;
            }
        }
        
        if (allFound) {
            logMsg('success', 'All provided nodes found in the cluster');
        }
        
        // Clean up
        await singleNode.quit();
        
        return parsedNodes;
    } catch (error) {
        logMsg('error', `Failed to validate cluster topology: ${error.message}`);
        return null;
    }
}

// Main test function
async function runClusterTests() {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const timeout = args.find(arg => arg.startsWith('--timeout='));
    if (timeout) {
        testTimeout = parseInt(timeout.split('=')[1], 10);
    }
    
    const password = args.find(arg => arg.startsWith('--password='));
    const passwordValue = password ? password.split('=')[1] : '12345';
    
    // Configure your cluster nodes here
    const nodes = [
        { host: 'redis-001.vortus-redis-ha.svc.cluster.local', port: 6379 },
        { host: 'redis-002.vortus-redis-ha.svc.cluster.local', port: 6379 },
        { host: 'redis-003.vortus-redis-ha.svc.cluster.local', port: 6379 },
        { host: 'redis-004.vortus-redis-ha.svc.cluster.local', port: 6379 },
        { host: 'redis-005.vortus-redis-ha.svc.cluster.local', port: 6379 },
        { host: 'redis-006.vortus-redis-ha.svc.cluster.local', port: 6379 }
    ];
    
    // Connection options
    const options = {
        password: passwordValue,
        showFriendlyErrorStack: true
    };
    
    logMsg('info', '=== Redis Cluster Connection Test ===');
    logMsg('info', `Timeout: ${testTimeout}ms`);
    logMsg('info', `Nodes: ${nodes.map(n => `${n.host}:${n.port}`).join(', ')}`);
    
    // Validate cluster topology first
    const topology = await validateClusterTopology(nodes, options);
    if (!topology) {
        logMsg('error', 'Cluster topology validation failed, but continuing with connection tests');
    }
    
    // Run direct ioredis connection test
    const directTestResult = await testDirectClusterConnection(nodes, options);
    logMsg(directTestResult ? 'success' : 'error', 
          `Direct ioredis connection test ${directTestResult ? 'PASSED' : 'FAILED'}`);
    
    // Run RedisService connection test
    const serviceTestResult = await testServiceClusterConnection(nodes, options);
    logMsg(serviceTestResult ? 'success' : 'error', 
          `RedisService connection test ${serviceTestResult ? 'PASSED' : 'FAILED'}`);
    
    // Overall test results
    logMsg('info', '=== Test Summary ===');
    logMsg(directTestResult && serviceTestResult ? 'success' : 'error', 
          `Overall test result: ${directTestResult && serviceTestResult ? 'PASSED' : 'FAILED'}`);
    
    // Exit with appropriate code
    process.exit(directTestResult && serviceTestResult ? 0 : 1);
}

// Run the tests
runClusterTests().catch(err => {
    logMsg('error', `Unhandled error in test script: ${err.message}`);
    if (err.stack) {
        console.error(err.stack);
    }
    process.exit(1);
});
