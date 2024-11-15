'use strict';

const { RedisService, LuaScriptService } = require('../src/index');
// const pine = require('pine');

async function main() {
    try {
        // Setup custom logger
        // RedisService.setupLogger(pine);

        LuaScriptService.register('zaddLimit2', {
            numberOfKeys: 1,
            lua: `
                local currentCount = redis.call('ZCARD', KEYS[1])
                if currentCount < ARGV[4] then
                    return redis.call('ZADD', KEYS[1], ARGV[1], ARGV[2])
                else
                    local removed = redis.call('ZREVRANGE', KEYS[1], 0, ARGV[3] - 1)
                    for i, v in ipairs(removed) do
                        redis.call('ZREM', KEYS[1], v)
                    end
                    return redis.call('ZADD', KEYS[1], ARGV[1], ARGV[2])
                end
            `
        });

        // Create a new Redis connection with Lua scripts
        const connectionName = 'main';
        await RedisService.createConnection(connectionName, {
            host: '127.0.0.1',
            port: 6379,
            db: 0,
        }, [ 'zaddLimit2' ]);

        // Get the Redis connection instance
        const redis = RedisService.getConnection(connectionName);

        // Example usage of Lua scripts
        const key = 'mySortedSet';
        const member = 'member1';
        const score = 10;
        const limit = 5;
        const offset = 0;

        // Use the zaddLimit Lua script
        const result = await redis.zaddLimit2(key, score, member, limit, offset);
        console.log('Result of zaddLimit2:', result);

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