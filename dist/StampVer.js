#!/usr/bin/env node
"use strict";

var _StampVerTool = require("./StampVerTool");

var _chalk = _interopRequireDefault(require("chalk"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const log = {
  info: console.info,
  error: function () {
    console.error(_chalk.default.red("error:", [...arguments].join(" ")));
  },
  warning: function () {
    console.error(_chalk.default.yellow("warning:", [...arguments].join(" ")));
  }
};
const stampVer = new _StampVerTool.StampVerTool(log);
stampVer.run(process.argv.slice(2)).then(exitCode => {
  process.exitCode = exitCode;
}).catch(err => {
  log.error(err);
});
//# sourceMappingURL=stampver.js.map