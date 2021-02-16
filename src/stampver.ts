#!/usr/bin/env node
import { StampVerTool } from "./StampVerTool"
import chalk from "chalk"
import path from "path"
import { Logger } from "./Logger"

class ConsoleLogger implements Logger {
  info(...params) {
    console.info(...params)
  }
  error(...params) {
    console.error(chalk.red("error:", [...params].join(" ")))
  }
  warning(...params) {
    console.error(chalk.yellow("warning:", [...params].join(" ")))
  }
}

const log = new ConsoleLogger()
const tool = new StampVerTool({
  toolName: path.basename(process.argv[1], ".js"),
  log,
})
tool
  .run(process.argv.slice(2))
  .then((exitCode) => {
    process.exitCode = exitCode
  })
  .catch((error) => {
    process.exitCode = 200

    if (error) {
      let message = error.message ?? ""

      if (tool.debug) {
        message += " (" + error.stack.substring(error.stack.indexOf("\n")) + ")"
      }

      log.error(message)
    }
  })
