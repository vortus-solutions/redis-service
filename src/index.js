'use strict';

const redisService = require('./redisService');
const luaScriptService = require('./luaScriptService');

module.exports = {
    RedisService: redisService,
    LuaScriptService: luaScriptService
};