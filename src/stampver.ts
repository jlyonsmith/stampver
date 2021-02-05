#!/usr/bin/env node
import { StampVerTool } from "./StampVerTool"
import chalk from "chalk"
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
const tool = new StampVerTool("stampver", log)
tool
  .run(process.argv.slice(2))
  .then((exitCode) => {
    process.exitCode = exitCode
  })
  .catch((err) => {
    if (tool.debug) {
      console.log(err)
    }
    log.error(err)
  })
