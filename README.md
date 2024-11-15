# Redis Service Package with Lua Scripts

A Node.js package that provides a robust Redis service implementation with built-in Lua script support. This package helps manage Redis connections and execute predefined Lua scripts efficiently.

## Features

- Connection management for multiple Redis instances
- Built-in Lua scripts for common operations
- Auto-pipelining support
- Promise-based API
- Connection error handling
- Customizable configuration

## Installation

```bash
npm install redis-service-lua
```

## Basic Usage

```javascript
const { RedisService } = require('redis-service-lua');

// Initialize Redis service with desired Lua scripts
const redisService = new RedisService({}, ['zaddLimit', 'expireNX']);

// Create a connection
await redisService.createConnection('main', {
    host: '127.0.0.1',
    port: 6379,
    db: 0
});

// Get connection instance
const redis = redisService.getConnection('main');
```

## Available Lua Scripts

### zaddLimit
Adds a member to a sorted set with a limit on the total number of members.

**Parameters:**
- Key: Sorted set key
- Score: Member score
- Member: Value to add
- Limit: Maximum number of members
- Offset: Number of members to remove from start

### expireNX
Sets expiration on a key only if it doesn't have one.

**Parameters:**
- Key: Redis key
- TTL: Time to live in seconds

### setHIfHigher
Sets hash field value only if new value is higher than existing.

**Parameters:**
- Key: Hash key
- Field: Hash field
- Value: New value

### setHIfLower
Sets hash field value only if new value is lower than existing.

**Parameters:**
- Key: Hash key
- Field: Hash field
- Value: New value

### getPolylineChunks
Retrieves polyline chunks based on latitude and longitude bounds.

**Parameters:**
- Key: Base key for polyline data
- Latitude: Target latitude
- Longitude: Target longitude

## API Reference

### RedisService

#### Constructor
```javascript
new RedisService(options = {}, luaScriptNames = [])
```

#### Methods
- `createConnection(connectionName, customOptions)`: Creates new Redis connection
- `getConnection(connectionName)`: Returns existing connection
- `closeAll()`: Closes all active connections

### LuaScriptsService

#### Methods
- `register(name, script)`: Register new Lua script
- `get(name)`: Get script by name
- `getScripts(names)`: Get multiple scripts
- `getAvailableScripts()`: List all available scripts

## Configuration Options

```javascript
const defaultOptions = {
    enableAutoPipelining: false,
    showFriendlyErrorStack: true,
    enableOfflineQueue: true,
    host: '127.0.0.1',
    port: 6379,
    db: 0
};
```

## Error Handling

The package includes built-in error handling for connection issues:

```javascript
try {
    await redisService.createConnection('main');
} catch (error) {
    console.error('Redis connection error:', error);
}
```

## Best Practices

1. Always close connections when done:
```javascript
await redisService.closeAll();
```

2. Reuse connections instead of creating new ones
3. Handle connection errors appropriately
4. Use auto-pipelining for bulk operations

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.