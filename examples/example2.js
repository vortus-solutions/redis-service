// Example usage
const RedisService = require('./RedisService');
const luaScriptsService = require('./luaScriptsService');

// Register a new custom script
luaScriptsService.register('incrementIfExists', {
    numberOfKeys: 1,
    lua: `
        local exists = redis.call('exists', KEYS[1])
        if exists == 1 then
            return redis.call('incr', KEYS[1])
        else
            return nil
        end
    `
});

async function main() {
    // Create Redis service with only specific scripts
    const redis = new RedisService(
        { 
            host: '127.0.0.1',
            port: 6379 
        },
        ['zaddLimit', 'incrementIfExists'] // Only these scripts will be loaded
    );

    // Create a connection
    await redis.createConnection('main');
    
    // Use the connection
    const connection = redis.getConnection('main');
    
    // Now you can use your specific Lua scripts
    await connection.zaddLimit('mykey', 1, 'value', 10);
    await connection.incrementIfExists('counter');
    
    // Close connections when done
    await redis.closeAll();
}

main().catch(console.error);