#!/usr/bin/env node
import { StampVerTool } from './StampVerTool'
import chalk from 'chalk'

const log = {
  info: console.info,
  error: function () { console.error(chalk.red('error:', [...arguments].join(' '))) },
  warning: function () { console.error(chalk.yellow('warning:', [...arguments].join(' '))) }
}

const stampVer = new StampVerTool(log)
stampVer.run(process.argv.slice(2)).then((exitCode) => {
  process.exitCode = exitCode
}).catch((err) => {
  log.error(err)
})
