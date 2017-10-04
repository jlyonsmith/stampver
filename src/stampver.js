import parseArgs from 'minimist'
import fs from 'fs'
import path from 'path'
import JSON5 from 'json5'
import { version } from './version'
import xregexp from 'xregexp'
import minimatch from 'minimatch'
import util from 'util'
import moment from 'moment-timezone'

class StampVer {
  constructor(log) {
    this.log = log
    this.run = this.run.bind(this)
  }

  findVersionFile() {
    let dir = process.cwd()

    while (dir.length !== 0) {
      const filename = path.join(dir, 'version.json5')

      if (fs.existsSync(filename)) {
        return filename
      } else {
        dir = dir.substring(0, dir.lastIndexOf('/'))
      }
    }

    return null
  }

  static getFullDate(now) {
    return now.year() * 10000 + (now.month() + 1) * 100 + now.date()
  }

  static getJDate(now, startYear) {
    return (((now.year() - startYear + 1) * 10000) + (now.month() * 100) + now.date()).toString()
  }

  static replaceTags(str, tags) {
    // TODO: This is horribly inefficient - takes multiple passed over the whole string <sigh>
    Object.entries(tags).forEach(arr => {
      str = str.replace('\$\{' + arr[0] + '\}', arr[1])
    })
    return str
  }

  async run(argv) {
    const options = {
      string: [ 'increment' ],
      boolean: [ 'help', 'version', 'update' ],
      alias: {
        'u': 'update',
        'i': 'increment'
      },
      default: {
        'increment': 'none'
      }
    }
    let args = parseArgs(argv, options)

    if (args.help) {
      this.log.info(`
Version stamper.

Usage: stampver [-u] [<version-file>]

<version-file> defaults to 'version.json5'.

Will increment the build and/or revision number and search/replace all version other
information in a list of files.

Searches for a 'version.json5' file in the current and parent directories and uses
that as the root directory for project files. See https://github.com/jlyonsmith/stampver
for the format of the version.json5 file.

-u, --update            Actually do the file updates. Defaults to just reporting changes.
-i, --increment <part>  Also increment one of major, minor or patch parts of version.
                        Defaults to none.  Updating major will reset minor and patch to zero,
                        updating minor will just reset patch.
--help                  Displays this help
--version               Displays tool version
`)
      return 0
    }

    let versionFn = (args['_'].length > 0 ? args['_'][0] : null)

    if (versionFn && !fs.existSync(versionFn)) {
      this.log.error(`Unable to find file '${versionFn}'`)
      return -1
    }

    versionFn = this.findVersionFile()

    if (!versionFn) {
      this.log.error(`Unable to find version.json5 file in this or parent directories`)
      return -1
    }

    versionFn = path.resolve(versionFn)

    if (this.versionFn && !fs.existsSync(this.versionFn)) {
      this.log.error(`File '${this.versionFn}' does not exist`)
      return -1
    }

    this.log.info(`Version file is '${versionFn}''`)

    let data = null
    try {
      const json5 = await util.promisify(fs.readFile)(versionFn, { encoding: 'utf8' })
      data = JSON5.parse(json5)
    } catch (error) {
      this.log.error(`'${versionFn}': ${error.message}`)
      return -1
    }

    const now = moment.tz(moment(), data.tz)
    let build

    this.log.info(`Using '${data.buildFormat}' for build number format`)

    switch (data.buildFormat) {
      case 'jdate':
        build = StampVer.getJDate(now, data.startYear)

        if (data.tags.build !== build) {
          data.tags.build = build
          data.tags.revision = 0
        } else {
          data.tags.revision += 1
        }
        break

      case 'full':
        build = StampVer.getFullDate(now)

        if (data.tags.build !== build) {
          data.tags.build = build
          data.tags.revision = 0
        } else {
          data.tags.revision += 1
        }
        break

      case 'incr':
        data.tags.build += 1
        data.tags.revision = 0
        break

      default:
        this.log.error(`Unknown build number format ${data.buildFormat}. Must be 'jdate', 'full' or 'incr'`)
        return -1
    }

    this.log.info('Version tags are:')

    Object.entries(data.tags).forEach(arr => {
      this.log.info(`  ${arr[0]}='${arr[1]}'`)
    })

    if (args.update) {
      this.log.info('Updating version information:')
    }

    const versionDirname = path.dirname(versionFn)

    for (let filename of data.filenames) {
      let match = false

      for (let fileType of data.fileTypes) {
        if (minimatch(filename, fileType.glob)) {
          continue
        }

        match = true

        const fullFilename = path.resolve(path.join(versionDirname, filename))

        if (fileType.write) {
          const dirname = File.dirname(fullFilename)

          if (!fs.existsSync(dirname)) {
            this.log.error(`Directory '${dirname}' does not exist`)
            return -1
          }

          if (args.update) {
            await util.promisify(fs.writeFile)(filename, replaceTags(fileType.write, data.tags))
          }
        } else {
          if (fs.existsSync(filename)) {
            const updates = fileType.updates || [ fileType.update ]
            let content = await util.promisify(fs.readFile)(fullFilename, { encoding: 'utf8' })

            updates.forEach(update => {
              content = StampVer.replaceTags(content, data.tags)
            })

            await util.promisify(fs.writeFile)(fullFilename, content)
          } else {
            this.log.error(`file '${fullFilename}' does not exist to update`)
            return -1
          }
        }

        if (!match) {
          this.log.error(`File '${fullFilename}' has no matching file type`)
          continue
        }
      }
    }

    if (args.update) {
      await util.promisify(fs.writeFile)(versionFn, JSON5.stringify(data))
    }

    return 0
  }
}

const stampVer = new StampVer(console)
stampVer.run(process.argv.slice(2)).then((exitCode) => {
  process.exit(exitCode)
}).catch((err) => {
  console.error(err)
})
