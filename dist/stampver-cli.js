#!/usr/bin/env node
'use strict';

var _StampVer = require('./StampVer');

var _chalk = require('chalk');

var _chalk2 = _interopRequireDefault(_chalk);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const log = {
  info: console.info,
  error: function () {
    console.error(_chalk2.default.red('error:', [...arguments].join(' ')));
  },
  warning: function () {
    console.error(_chalk2.default.yellow('warning:', [...arguments].join(' ')));
  }
};

const stampVer = new _StampVer.StampVer(log);
stampVer.run(process.argv.slice(2)).then(exitCode => {
  process.exit(exitCode);
}).catch(err => {
  log.error(err);
});
//# sourceMappingURL=stampver-cli.js.map