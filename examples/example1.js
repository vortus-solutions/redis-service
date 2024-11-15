'use strict';

const RedisService = require('../src/redisService');

// Custom logger implementation
const customLogger = {
    info: (...args) => console.log('[Custom Info]:', ...args),
    error: (...args) => console.error('[Custom Error]:', ...args),
    debug: (...args) => console.debug('[Custom Debug]:', ...args),
    warn: (...args) => console.warn('[Custom Warn]:', ...args)
};

async function main() {
    try {
        // Setup custom logger
        RedisService.setupLogger(customLogger);

        // Create a new Redis connection
        const connectionName = 'main';
        await RedisService.createConnection(connectionName, {
            host: '127.0.0.1',
            port: 6379,
            db: 0
        }, ['zaddLimit', 'expireNX']);

        // Get the Redis connection instance
        const redis = RedisService.getConnection(connectionName);

        // Example usage of Lua scripts
        const key = 'mySortedSet';
        const member = 'member1';
        const score = 10;
        const limit = 5;
        const offset = 0;

        // Use the zaddLimit Lua script
        const result = await redis.zaddLimit(key, score, member, limit, offset);
        console.log('Result of zaddLimit:', result);

        // Set expiration using expireNX Lua script
        const ttl = 60; // 60 seconds
        await redis.expireNX(key, ttl);
        console.log(`Expiration set for key "${key}" for ${ttl} seconds.`);

    } catch (error) {
        console.error('An error occurred:', error);
    } finally {
        // Close all connections
        await RedisService.closeAll();
        console.log('All Redis connections closed.');
    }
}

// Run the main function
main();