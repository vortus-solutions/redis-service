'use strict';

/**
 * Redis Service Module
 * A comprehensive Redis connection management service that extends EventEmitter
 * to provide event-driven Redis connection handling.
 * 
 * @requires ioredis - Redis client for Node.js with promises support
 * @requires events - Node.js built-in event emitter
 * @requires ./luaScriptService - Custom service for handling Lua scripts
 */

const Redis = require('ioredis');
const EventEmitter = require('events');
const luaScriptsService = require('./luaScriptService');

/**
 * Default logger configuration
 * Provides basic logging functionality with different severity levels
 * Each method prepends a Redis-specific prefix to the log message
 */
const defaultLogger = {
    info: (...args) => console.log('[Redis Info]:', ...args),
    error: (...args) => console.error('[Redis Error]:', ...args),
    debug: (...args) => console.debug('[Redis Debug]:', ...args),
    warn: (...args) => console.warn('[Redis Warn]:', ...args)
};

/**
 * List of Redis events that will be forwarded through the service
 * These events are essential for monitoring Redis connection status
 */
const REDIS_EVENTS = [
    'connect',    // Emitted when connection is established
    'ready',      // Emitted when Redis is ready to receive commands
    'error',      // Emitted when an error occurs
    'close',      // Emitted when connection is closed
    'reconnecting', // Emitted when trying to reconnect
    'end',        // Emitted when connection is terminated
    'wait',       // Emitted when waiting for connection
    'select'      // Emitted when database is selected
];

/**
 * RedisService Class
 * Manages multiple Redis connections with support for:
 * - Custom logging
 * - Event forwarding
 * - Lua script integration
 * - Connection lifecycle management
 * 
 * @extends EventEmitter
 */
class RedisService extends EventEmitter {
    /**
     * Initialize the Redis service
     * Sets up connection storage and default logger
     */
    constructor() {
        super();
        this.connections = new Map(); // Stores active connections
        this.logger = defaultLogger;
    }

    /**
     * Configure custom logger for the service
     * @param {Object} customLogger - Custom logger implementation
     * @throws {Error} If required logging methods are not implemented
     */
    setupLogger(customLogger) {
        if (!customLogger) return defaultLogger;

        const requiredMethods = ['info', 'error', 'debug', 'warn'];
        const missingMethods = requiredMethods.filter(
            method => typeof customLogger[method] !== 'function'
        );

        if (missingMethods.length > 0) {
            throw new Error(
                `Custom logger must implement these methods: ${missingMethods.join(', ')}`
            );
        }

        this.logger = customLogger;
    }

    /**
     * Create a new Redis connection
     * @param {string} connectionName - Unique identifier for the connection
     * @param {Object} options - Redis connection options
     * @param {string[]} luaScriptNames - Names of Lua scripts to load
     * @returns {Promise<Redis>} Promise resolving to Redis connection
     * @throws {Error} If connection with same name already exists
     * 
     * Default connection options:
     * - host: '127.0.0.1'
     * - port: 6379
     * - db: 0
     * - enableAutoPipelining: false
     * - showFriendlyErrorStack: true
     * - enableOfflineQueue: true
     */
    async createConnection(connectionName, options = {}, luaScriptNames = []) {
        if (this.connections.has(connectionName)) {
            const error = new Error(`Connection ${connectionName} already exists`);
            this.emit('error', error);
            throw error;
        }

        const connectionOptions = {
            enableAutoPipelining: false,
            showFriendlyErrorStack: true,
            enableOfflineQueue: true,
            host: '127.0.0.1',
            port: 6379,
            db: 0,
            ...options
        };

        if (options.logger) {
            this.setupLogger(options.logger);
        }

        this.logger.debug(`Creating Redis connection: ${connectionName}`, connectionOptions);
        this.emit('connectionAttempt', { connectionName, options: connectionOptions });

        const connection = new Redis(connectionOptions);
        const luaScripts = luaScriptNames.length > 0
            ? luaScriptsService.getScripts(luaScriptNames)
            : {};

        // Set up event forwarding
        this._setupEventForwarding(connection, connectionName);

        return this._handleConnectionPromise(connection, connectionName, luaScripts);
    }

    /**
     * Set up event forwarding for Redis connection
     * @private
     * @param {Redis} connection - Redis connection instance
     * @param {string} connectionName - Connection identifier
     */
    _setupEventForwarding(connection, connectionName) {
        REDIS_EVENTS.forEach(eventName => {
            connection.on(eventName, (...args) => {
                this.emit(`${connectionName}:${eventName}`, ...args);
                this.emit('redis', {
                    connection: connectionName,
                    event: eventName,
                    args
                });
            });
        });
    }

    /**
     * Handle connection promise and setup
     * @private
     * @param {Redis} connection - Redis connection instance
     * @param {string} connectionName - Connection identifier
     * @param {Object} luaScripts - Lua scripts to be loaded
     * @returns {Promise<Redis>} Promise resolving to Redis connection
     */
    _handleConnectionPromise(connection, connectionName, luaScripts) {
        return new Promise((resolve, reject) => {
            connection.on('connect', () => {
                this.logger.info(`Redis ${connectionName} is connected successfully`);
                this.connections.set(connectionName, {
                    connection,
                    luaScripts
                });
                this.defineLuaCommands(connection, luaScripts, connectionName);
                this.emit('connectionEstablished', connectionName);
                resolve(connection);
            });

            // Error handling
            connection.on('error', (error) => {
                this.logger.error(`Redis ${connectionName} connection error:`, error);
                this.emit('connectionError', { connectionName, error });
                reject(error);
            });

            // Connection lifecycle events
            this._setupLifecycleEvents(connection, connectionName);
        });
    }

    /**
     * Setup connection lifecycle events
     * @private
     * @param {Redis} connection - Redis connection instance
     * @param {string} connectionName - Connection identifier
     */
    _setupLifecycleEvents(connection, connectionName) {
        connection.on('close', () => {
            this.logger.warn(`Redis ${connectionName} connection closed`);
            this.emit('connectionClosed', connectionName);
        });

        connection.on('reconnecting', (delay) => {
            this.logger.info(`Redis ${connectionName} reconnecting after ${delay}ms`);
            this.emit('connectionReconnecting', { connectionName, delay });
        });

        connection.on('end', () => {
            this.logger.info(`Redis ${connectionName} connection ended`);
            this.emit('connectionEnded', connectionName);
        });
    }

    /**
     * Retrieve an existing Redis connection
     * @param {string} connectionName - Connection identifier
     * @returns {Redis} Redis connection instance
     * @throws {Error} If connection does not exist
     */
    getConnection(connectionName) {
        const connectionData = this.connections.get(connectionName);
        if (!connectionData) {
            const error = new Error(`Connection ${connectionName} not found`);
            this.logger.error(error.message);
            this.emit('error', error);
            throw error;
        }
        return connectionData.connection;
    }

    /**
     * Define Lua commands for a Redis connection
     * @param {Redis} connection - Redis connection instance
     * @param {Object} luaScripts - Lua scripts to define
     * @param {string} connectionName - Connection identifier
     */
    defineLuaCommands(connection, luaScripts, connectionName) {
        Object.entries(luaScripts).forEach(([commandName, command]) => {
            this.logger.debug(`Defining Lua command: ${commandName} for connection: ${connectionName}`);
            connection.defineCommand(commandName, command);
            this.emit('luaCommandDefined', { connectionName, commandName });
        });
    }

    /**
     * Close all active Redis connections
     * @returns {Promise<void>} Promise that resolves when all connections are closed
     */
    async closeAll() {
        this.logger.info('Closing all Redis connections');
        this.emit('closingAllConnections');

        const closePromises = Array.from(this.connections.values()).map(
            async ({ connection }) => {
                const result = await connection.quit();
                this.emit('connectionClosed', connection);
                return result;
            }
        );

        await Promise.all(closePromises);
        this.connections.clear();
        this.logger.info('All Redis connections closed successfully');
        this.emit('allConnectionsClosed');
    }
}

// Export singleton instance
module.exports = new RedisService();