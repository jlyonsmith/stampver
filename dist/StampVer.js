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
const tool = new _StampVerTool.StampVerTool("stampver", log);
tool.run(process.argv.slice(2)).then(exitCode => {
  process.exitCode = exitCode;
}).catch(err => {
  if (tool.debug) {
    console.log(err);
  }

  log.error(err);
});
//# sourceMappingURL=StampVer.js.map