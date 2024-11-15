'use strict';

const redisService = require('./redisService');
const luaScriptsService = require('./luaScriptsService');

module.exports = {
    RedisService: redisService,
    LuaScriptsService: luaScriptsService
};