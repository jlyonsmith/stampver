import parseArgs from 'minimist'
import fs from 'fs'
import path from 'path'
import JSON5 from 'json5'
import { fullVersion } from './version'
import XRegExp from 'xregexp'
import minimatch from 'minimatch'
import util from 'util'
import moment from 'moment-timezone'

export class StampVer {
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
    const tagPrefix = '${'
    const tagSuffix = '}'

    for (let i = str.length - 1; i != -1; ) {
      const tagEnd = str.lastIndexOf(tagSuffix, i)

      if (tagEnd <= 0) {
          break
      }

      const tagStart = str.lastIndexOf(tagPrefix, tagEnd - 1)

      if (tagStart < 0) {
          break
      }

      const key = str.substring(tagStart + tagPrefix.length, tagEnd)
      const tag = tags[key]

      if (typeof tag !== 'undefined') {
        str = str.substring(0, tagStart) + tag + str.substring(tagEnd + tagSuffix.length)
      }

      i = tagStart - 1
    }
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
Version stamper

Usage: stampver [-u] [<version-file>]

<version-file> defaults to 'version.json5'.

Will increment the build and/or revision number and search/replace all other version
related information in a list of files.

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

    if (args.version) {
      this.log.info(`v${fullVersion}`)
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
    const newMajorMinorPatch = (args.increment !== 'none')
    let build

    if (newMajorMinorPatch) {
      switch (args.increment) {
        case 'major':
          data.tags.major += 1
          data.tags.minor = 0
          data.tags.patch = 0
          break
        case 'minor':
          data.tags.minor += 1
          data.tags.patch = 0
          break
        case 'patch':
          data.tags.patch += 1
          break
      }
    }

    switch (data.buildFormat) {
      case 'jdate':
        build = StampVer.getJDate(now, data.startYear)

        if (newMajorMinorPatch || data.tags.build !== build) {
          data.tags.build = build
          data.tags.revision = 0
        } else {
          data.tags.revision += 1
        }
        break

      case 'full':
        build = StampVer.getFullDate(now)

        if (newMajorMinorPatch || data.tags.build !== build) {
          data.tags.build = build
          data.tags.revision = 0
        } else {
          data.tags.revision += 1
        }
        break

      case 'incr':
        if (newMajorMinorPatch) {
           data.tags.build = 0
        } else {
          data.tags.build += 1
        }
        data.tags = revision = 0
        break

      default:
        this.log.error(`Unknown build number format ${data.buildFormat}. Must be 'jdate', 'full' or 'incr'`)
        return -1
    }

    this.log.info('Tags are:')

    Object.entries(data.tags).forEach(arr => {
      this.log.info(`  ${arr[0]}='${arr[1]}'`)
    })

    const versionDirname = path.dirname(versionFn)

    this.log.info(`${args.update ? 'Updating' : 'Checking'} file list:`)

    for (let filename of data.filenames) {
      let match = false
      const fullFilename = path.resolve(path.join(versionDirname, filename))

      this.log.info(`  ${fullFilename}`)

      for (let fileType of data.fileTypes) {
        if (!minimatch(filename, fileType.glob)) {
          continue
        }

        match = true

        if (fileType.write) {
          const dirname = path.dirname(fullFilename)

          if (!fs.existsSync(dirname)) {
            this.log.error(`Directory '${dirname}' does not exist`)
            return -1
          }

          if (args.update) {
            await util.promisify(fs.writeFile)(filename, StampVer.replaceTags(fileType.write, data.tags))
          }
        } else {
          if (fs.existsSync(fullFilename)) {
            const updates = fileType.updates || [ fileType.update ]
            let content = await util.promisify(fs.readFile)(fullFilename, { encoding: 'utf8' })

            updates.forEach(update => {
              let found = false
              let replace = StampVer.replaceTags(update.replace, data.tags)
              let search = new XRegExp(update.search, 'm')
              content = XRegExp.replace(content, search, (match) => {
                found = true
                return StampVer.replaceTags(replace, match)
              }, 'one')

              if (!found) {
                this.log.warning(`File type '${fileType.name}' update '${update.search}' did not match anything`)
              }
            })

            if (args.update) {
              await util.promisify(fs.writeFile)(fullFilename, content)
            }
          } else {
            this.log.error(`File '${fullFilename}' does not exist to update`)
            return -1
          }
        }

        if (match) {
          break
        }
      }

      if (!match) {
        this.log.error(`File '${fullFilename}' has no matching file type`)
        continue
      }
    }

    if (args.update) {
      await util.promisify(fs.writeFile)(versionFn, JSON5.stringify(data, null, '  '))
    }

    return 0
  }
}
