# Redis Cluster Connection Guide for ioredis

This document provides guidance on how to properly connect to a Redis Cluster using the ioredis library and our RedisService wrapper.

## Understanding Redis Cluster

Redis Cluster provides a way to run a Redis installation where data is automatically sharded across multiple Redis nodes. This offers several benefits:

- **Horizontal Scalability**: Distribute your data across multiple nodes
- **High Availability**: Automatic failover when a master node fails
- **Better Performance**: Distribute load across multiple nodes

## Connecting to a Redis Cluster with ioredis

### Direct Connection (Using ioredis)

```javascript
const Redis = require('ioredis');

const cluster = new Redis.Cluster([
  { host: 'redis-node1.example.com', port: 6379 },
  { host: 'redis-node2.example.com', port: 6379 },
  { host: 'redis-node3.example.com', port: 6379 }
], {
  redisOptions: {
    password: 'your-password',
    tls: {} // Enable if using TLS
  },
  // Cluster-specific options
  scaleReads: 'slave',          // Read from slaves for load balancing
  maxRedirections: 16,          // Maximum redirections to follow
  retryDelayOnFailover: 100,    // Retry delay on failover (ms)
  retryDelayOnClusterDown: 100, // Retry delay when cluster down (ms)
  enableReadyCheck: true,       // Check cluster state before ready
});
```

### Using Our RedisService Wrapper

```javascript
const { RedisService } = require('@vortus-solutions/redis-service');

// Define your cluster configuration
const clusterConfig = {
  nodes: [
    { host: 'redis-node1.example.com', port: 6379 },
    { host: 'redis-node2.example.com', port: 6379 },
    { host: 'redis-node3.example.com', port: 6379 }
  ],
  password: 'your-password',
  keyPrefix: 'app:',             // Optional prefix for all keys
  showFriendlyErrorStack: true,  // For better error messages (dev only)
  enableOfflineQueue: true       // Queue commands when connection is down
};

// Create cluster connection and get instance
const redis = await RedisService.createClusterConnection('clusterInstance', clusterConfig, []);
```

## Special Considerations for Cluster Mode

### 1. Key Distribution with Slots

Redis Cluster divides the key space into 16384 slots. Keys are assigned to slots using a hash function, and each node is responsible for a subset of slots.

All keys with the same hash tag `{tag}` are guaranteed to be in the same hash slot:

```javascript
// These keys will be in the same slot
redis.set('user:{1234}:name', 'John');
redis.set('user:{1234}:email', 'john@example.com');
```

### 2. Pipeline and Transaction Limitations

When using pipelines in cluster mode, all keys must be assigned to the same hash slot (same node):

```javascript
// CORRECT - Using hash tags to ensure same slot
const pipeline = redis.pipeline();
pipeline.set('order:{12345}:items', 'item1,item2');
pipeline.set('order:{12345}:status', 'pending');
pipeline.exec();

// WRONG - Keys may be assigned to different slots
const pipeline = redis.pipeline();
pipeline.set('order:12345', 'data'); 
pipeline.set('user:5678', 'data');
// This may fail with: "All keys in the pipeline should belong to the same slots"
```

### 3. Multi/Transaction Support

You can't use `multi()` without pipeline in cluster mode. Always use:

```javascript
// CORRECT
redis.pipeline().multi().set('key', 'value').exec().exec();

// WRONG
redis.multi({ pipeline: false }); // This will fail in cluster mode
```

## Common Connection Issues & Solutions

### 1. Authentication Failures

If you're getting authentication errors:

```
Error: Redis connection error: ERR AUTH <password> called without any password configured
```

**Solution:** Ensure password is correctly specified in the `redisOptions` object:

```javascript
const cluster = new Redis.Cluster(nodes, {
  redisOptions: {
    password: 'your-correct-password'
  }
});
```

### 2. Connection Timeout

```
Error: Connection timeout
```

**Solution:** Increase the connection timeout and check network connectivity:

```javascript
const cluster = new Redis.Cluster(nodes, {
  redisOptions: {
    connectTimeout: 10000 // 10 seconds
  }
});
```

### 3. MOVED Errors

```
Error: MOVED 12182 redis-node2.example.com:6379
```

**Solution:** This is part of normal cluster operation but can indicate misconfiguration if excessive:

- Ensure `maxRedirections` is sufficient (default is 16)
- Use proper hash tags to avoid excessive redirections
- Check if your cluster is rebalancing frequently

### 4. CROSSSLOT Errors

```
Error: CROSSSLOT Keys in request don't hash to the same slot
```

**Solution:** Use hash tags to ensure keys are assigned to the same slot:

```javascript
// Use the same {tag} in keys
redis.mset('{user}:1:name', 'John', '{user}:2:name', 'Jane');
```

### 5. TLS/SSL Connection Issues

For secure connections to hosted Redis services:

```javascript
const cluster = new Redis.Cluster(nodes, {
  redisOptions: {
    tls: {
      // For self-signed certificates, you may need:
      rejectUnauthorized: false
    }
  },
  dnsLookup: (address, callback) => callback(null, address) // For AWS ElastiCache
});
```

## Best Practices

1. **Always provide multiple nodes** in your initial configuration, not just one.
2. **Use the same hash tag** `{tag}` for related keys that need to be processed together.
3. **Handle connection errors** gracefully with proper error handling and reconnection logic.
4. **Configure appropriate timeouts** based on your network characteristics.
5. **Set up proper monitoring** to track connection issues and performance.
6. **Consider read-write splitting** with `scaleReads: 'slave'` for read-heavy workloads.
7. **Implement proper connection cleanup** when shutting down applications.

## Debugging Connection Issues

When debugging cluster connection issues:

1. **Check cluster state** with `CLUSTER INFO` command
2. **Verify slot assignments** with `CLUSTER SLOTS`
3. **Test direct connections** to each node in the cluster
4. **Enable detailed error messages** with `showFriendlyErrorStack: true`
5. **Use connection events** to monitor connection lifecycle:

```javascript
cluster.on('error', (err) => console.error('Cluster error: ', err));
cluster.on('node error', (err, node) => console.error(`Node ${node} error:`, err));
cluster.on('+node', (node) => console.log(`Node ${node} added`));
cluster.on('-node', (node) => console.log(`Node ${node} removed`));
```

## References

- [ioredis Documentation](https://github.com/luin/ioredis)
- [Redis Cluster Specification](https://redis.io/topics/cluster-spec)
- [Redis Cluster Tutorial](https://redis.io/topics/cluster-tutorial)
