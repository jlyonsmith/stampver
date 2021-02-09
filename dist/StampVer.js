#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const StampVerTool_1 = require("./StampVerTool");
const chalk_1 = __importDefault(require("chalk"));
class ConsoleLogger {
    info(...params) {
        console.info(...params);
    }
    error(...params) {
        console.error(chalk_1.default.red("error:", [...params].join(" ")));
    }
    warning(...params) {
        console.error(chalk_1.default.yellow("warning:", [...params].join(" ")));
    }
}
const log = new ConsoleLogger();
const tool = new StampVerTool_1.StampVerTool({ toolName: "stampver", log });
tool
    .run(process.argv.slice(2))
    .then((exitCode) => {
    process.exitCode = exitCode;
})
    .catch((error) => {
    var _a;
    process.exitCode = 200;
    if (error) {
        let message = (_a = error.message) !== null && _a !== void 0 ? _a : "";
        if (tool.debug) {
            message += " (" + error.stack.substring(error.stack.indexOf("\n")) + ")";
        }
        log.error(message);
    }
});
//# sourceMappingURL=stampver.js.map