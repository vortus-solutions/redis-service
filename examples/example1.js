// Example usage:
const redisService = new RedisService({}, {
    customCommand: {
        numberOfKeys: 1,
        lua: `
        -- Custom Lua script
        return redis.call('get', KEYS[1])
	`
    }
});

// Create connections with custom options
await redisService.createConnection('engineControl', {
    host: process.env.ENGINE_CTRL_REDIS_HOST,
    port: process.env.ENGINE_CTRL_REDIS_PORT,
    db: process.env.ENGINE_CTRL_REDIS_DB
});

await redisService.createConnection('engineData', {
    host: process.env.ENGINE_DATA_REDIS_HOST,
    port: process.env.ENGINE_DATA_REDIS_PORT,
    db: process.env.ENGINE_DATA_REDIS_DB
});

// Get connections
const engineControl = redisService.getConnection('engineControl');
const engineData = redisService.getConnection('engineData');