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
npm install @vortus-solutions/redis-service
```

## Basic Usage

```javascript
const RedisService = require('@vortus-solutions/redis-service');

// Create a connection
await RedisService.createConnection('main', {
    host: '127.0.0.1',
    port: 6379,
    db: 0
}, []);

// Get connection instance
const redis = RedisService.getConnection('main');
```

## Available Lua Scripts

### zaddLimit
Adds a member to a sorted set with a limit on the total number of members.

**Parameters:**
- `key`: Sorted set key
- `score`: Member score
- `member`: Value to add
- `limit`: Maximum number of members
- `offset`: Number of members to remove from start

### expireNX
Sets expiration on a key only if it doesn't have one.

**Parameters:**
- `key`: Redis key
- `ttl`: Time to live in seconds

### setHIfHigher
Sets hash field value only if new value is higher than existing.

**Parameters:**
- `key`: Hash key
- `field`: Hash field
- `value`: New value

### setHIfLower
Sets hash field value only if new value is lower than existing.

**Parameters:**
- `key`: Hash key
- `field`: Hash field
- `value`: New value

### getPolylineChunks
Retrieves polyline chunks based on latitude and longitude bounds.

**Parameters:**
- `key`: Base key for polyline data
- `latitude`: Target latitude
- `longitude`: Target longitude

## API Reference

### RedisService

#### Constructor
```javascript
new RedisService()
```

#### Methods
- `createConnection(connectionName, options = {}, luaScriptNames = [])`: Creates a new Redis connection.
- `getConnection(connectionName)`: Returns the existing connection by name.
- `closeAll()`: Closes all active connections.

### LuaScriptsService

#### Methods
- `register(name, script)`: Register a new Lua script.
- `get(name)`: Get a script by name.
- `getScripts(names)`: Get multiple scripts by their names.
- `getAvailableScripts()`: List all available scripts.

## Configuration Options

Default connection options can be customized when creating a connection:

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
    await RedisService.createConnection('main');
} catch (error) {
    console.error('Redis connection error:', error);
}
```

## Best Practices

1. Always close connections when done:
   ```javascript
   await RedisService.closeAll();
   ```
2. Reuse connections instead of creating new ones.
3. Handle connection errors appropriately.
4. Use auto-pipelining for bulk operations.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.