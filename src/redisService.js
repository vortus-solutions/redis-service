'use strict';

const Redis = require('ioredis');
const luaScriptsService = require('./luaScriptService');

class RedisService {
	constructor(options = {}, luaScriptNames = []) {
		this.connections = new Map();
		this.defaultOptions = {
			enableAutoPipelining: false,
			showFriendlyErrorStack: true,
			enableOfflineQueue: true,
			host: '127.0.0.1',
			port: 6379,
			db: 0
		};

		// Get only the specified Lua scripts
		this.luaScripts = luaScriptNames.length > 0
			? luaScriptsService.getScripts(luaScriptNames)
			: {};
	}

	async createConnection(connectionName, customOptions = {}) {
		if (this.connections.has(connectionName)) {
			throw new Error(`Connection ${connectionName} already exists`);
		}

		const options = {
			...this.defaultOptions,
			...customOptions
		};

		const connection = new Redis(options);

		return new Promise((resolve, reject) => {
			connection.on('connect', () => {
				console.log(`Redis ${connectionName} is alive!`);
				this.connections.set(connectionName, connection);
				this.defineLuaCommands(connection);
				resolve(connection);
			});

			connection.on('error', (error) => {
				console.error(`Redis ${connectionName} connection error:`, error);
				reject(error);
			});
		});
	}

	getConnection(connectionName) {
		const connection = this.connections.get(connectionName);
		if (!connection) {
			throw new Error(`Connection ${connectionName} not found`);
		}
		return connection;
	}

	defineLuaCommands(connection) {
		Object.entries(this.luaScripts).forEach(([commandName, command]) => {
			connection.defineCommand(commandName, command);
		});
	}

	async closeAll() {
		const closePromises = Array.from(this.connections.values()).map(
			connection => connection.quit()
		);
		await Promise.all(closePromises);
		this.connections.clear();
	}
}

module.exports = RedisService;