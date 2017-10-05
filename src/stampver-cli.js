import { StampVer } from './tools/StampVer'

const log = {
  info: console.info,
  error: function() { console.error(chalk.red('error:', [...arguments].join(' ')))},
  warning: function() { console.error(chalk.yellow('warning:', [...arguments].join(' ')))}
}

const stampVer = new StampVer(log)
stampVer.run(process.argv.slice(2)).then((exitCode) => {
  process.exit(exitCode)
}).catch((err) => {
  log.error(err)
})
