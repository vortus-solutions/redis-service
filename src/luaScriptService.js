// luaScriptsService.js

class LuaScriptsService {
	constructor() {
		this.scripts = new Map();
		this.registerDefaultScripts();
	}

	registerDefaultScripts() {
		this.register('zaddLimit', {
			numberOfKeys: 1,
			lua: `
			redis.call('zadd', KEYS[1], ARGV[1], ARGV[2])
			local s = tonumber(redis.call('zcard', KEYS[1]))
			local i = tonumber(ARGV[4]) - 1
			if s > tonumber(ARGV[3]) then 
				redis.call('zremrangebyrank', KEYS[1], 0, i)
			end
        `
		});

		this.register('expireNX', {
			numberOfKeys: 1,
			lua: `
			local ttl = redis.call('ttl', KEYS[1])
			if ttl < 0 then 
				return redis.call('expire', KEYS[1], ARGV[1])
			end
        `
		});

		this.register('setHIfHigher', {
			numberOfKeys: 2,
			lua: `
			local c = tonumber(redis.call('hget', KEYS[1], KEYS[2]))
			if c then 
				if tonumber(ARGV[1]) > c then 
					redis.call('hset', KEYS[1], KEYS[2], ARGV[1])
					return tonumber(ARGV[1]) - c 
				else 
					return 0 
				end 
			else 
				return redis.call('hset', KEYS[1], KEYS[2], ARGV[1])
			end
        `
		});

		this.register('setHIfLower', {
			numberOfKeys: 2,
			lua: `
			local c = tonumber(redis.call('hget', KEYS[1], KEYS[2]))
			if c then 
				if tonumber(ARGV[1]) < c then 
					redis.call('hset', KEYS[1], KEYS[2], ARGV[1])
					return tonumber(ARGV[1]) - c 
				else 
					return 0 
				end 
			else 
				return redis.call('hset', KEYS[1], KEYS[2], ARGV[1])
			end
        `
		});

		this.register('getPolylineChunks', {
			numberOfKeys: 1,
			lua: `
			local latminkey = KEYS[1] .. ':bbox:lat:min'
			local latmaxkey = KEYS[1] .. ':bbox:lat:max'
			local lonminkey = KEYS[1] .. ':bbox:lon:min'
			local lonmaxkey = KEYS[1] .. ':bbox:lon:max'
			local tmpkey = KEYS[1] .. ':tmp'
			local lat = tonumber(ARGV[1])
			local lon = tonumber(ARGV[2])
			
			local latmin = redis.call('zrange', latminkey, '-inf', lat, 'BYSCORE')
			local latmax = redis.call('zrange', latmaxkey, lat, '+inf', 'BYSCORE')
			local lonmin = redis.call('zrange', lonminkey, '-inf', lon, 'BYSCORE')
			local lonmax = redis.call('zrange', lonmaxkey, lon, '+inf', 'BYSCORE')
			
			redis.call('DEL', tmpkey)
			
			for index, value in pairs(latmin) do
				redis.call('ZINCRBY', tmpkey, 1, value)
			end
			for index, value in pairs(latmax) do
				redis.call('ZINCRBY', tmpkey, 1, value)
			end
			for index, value in pairs(lonmin) do
				redis.call('ZINCRBY', tmpkey, 1, value)
			end
			for index, value in pairs(lonmax) do
				redis.call('ZINCRBY', tmpkey, 1, value)
			end
			
			return redis.call('zrange', tmpkey, 4, '+inf', 'BYSCORE')
        `
		});
	}

	/**
	 * Register a new Lua script
	 * @param {string} name - Script name
	 * @param {Object} script - Script definition with numberOfKeys and lua properties
	 */
	register(name, script) {
		if (!script.numberOfKeys || !script.lua) {
			throw new Error(`Invalid script format for ${name}`);
		}
		this.scripts.set(name, script);
	}

	/**
	 * Get a specific script by name
	 * @param {string} name - Script name
	 * @returns {Object|undefined} Script definition
	 */
	get(name) {
		return this.scripts.get(name);
	}

	/**
	 * Get multiple scripts by name
	 * @param {string[]} names - Array of script names
	 * @returns {Object} Object with requested scripts
	 */
	getScripts(names) {
		const result = {};
		names.forEach(name => {
			const script = this.get(name);
			if (script) {
				result[name] = script;
			}
		});
		return result;
	}

	/**
	 * Get all available script names
	 * @returns {string[]} Array of script names
	 */
	getAvailableScripts() {
		return Array.from(this.scripts.keys());
	}
}

// singleton
module.exports = new LuaScriptsService();