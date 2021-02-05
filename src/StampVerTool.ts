import parseArgs from "minimist"
import fs from "fs"
import path from "path"
import JSON5 from "@johnls/json5"
import { fullVersion } from "./version"
import XRegExp from "xregexp"
import minimatch from "minimatch"
import util from "util"
import { DateTime } from "luxon"
import { Logger } from "./Logger"

export class StampVerTool {
  name: string
  log: Logger
  debug: boolean
  versionFilename: string

  constructor(name: string, log: Logger) {
    this.name = name
    this.log = log
  }

  findVersionFile(): string {
    let dir = process.cwd()

    while (dir.length !== 0) {
      const filename = path.join(dir, "version.json5")

      if (fs.existsSync(filename)) {
        return filename
      } else {
        dir = dir.substring(0, dir.lastIndexOf("/"))
      }
    }

    return null
  }

  static getFullDate(dateTime: DateTime): string {
    return (
      dateTime.year * 10000 +
      (dateTime.month + 1) * 100 +
      dateTime.day
    ).toString()
  }

  static getJDate(dateTime: DateTime, startYear: number): string {
    return (
      (dateTime.year - startYear + 1) * 10000 +
      dateTime.month * 100 +
      dateTime.day
    ).toString()
  }

  static replaceTags(str: string, tags: Record<string, string>): string {
    const tagPrefix = "${"
    const tagSuffix = "}"

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

      if (typeof tag !== "undefined") {
        str =
          str.substring(0, tagStart) +
          tag +
          str.substring(tagEnd + tagSuffix.length)
      }

      i = tagStart - 1
    }
    return str
  }

  async run(argv: string[]): Promise<0 | -1> {
    const options = {
      string: ["increment"],
      boolean: ["help", "version", "update", "sequence", "debug"],
      alias: {
        u: "update",
        i: "increment",
        s: "sequence",
      },
      default: {
        increment: "none",
      },
    }
    const args = parseArgs(argv, options)

    if (args.help) {
      this.log.info(`
Version stamping tool

Usage: ${this.name} [-u] [<version-file>]

<version-file> defaults to 'version.json5' in the current directory.

Will increment the build and/or revision number and search/replace all other version
related information in a list of files.

Uses the version file as the root directory for project files. See
https://github.com/jlyonsmith/stampver for the format of the version.json5 file.

-u, --update            Actually do the file updates. Defaults to just reporting changes.
-i, --increment <part>  Also increment one of major, minor or patch parts of version.
                        Defaults to none.  Updating major will reset minor and patch to zero,
                        updating minor will just reset patch.
-s, --sequence          Increment the sequence number. Just a monotonically increasing
                        number.
--help                  Displays this help
--version               Displays tool version
--debug                 Get additional debugging information
`)
      return 0
    }

    if (args.version) {
      this.log.info(`${fullVersion}`)
      return 0
    }

    this.debug = args.debug

    let versionFilename = args["_"].length > 0 ? args["_"][0] : null

    if (versionFilename && !fs.existsSync(versionFilename)) {
      this.log.error(`Unable to find file '${versionFilename}'`)
      return -1
    }

    versionFilename = this.findVersionFile()

    if (!versionFilename) {
      this.log.error(
        `Unable to find version.json5 file in this or parent directories`
      )
      return -1
    }

    versionFilename = path.resolve(versionFilename)

    if (this.versionFilename && !fs.existsSync(this.versionFilename)) {
      this.log.error(`File '${this.versionFilename}' does not exist`)
      return -1
    }

    this.log.info(`Version file is '${versionFilename}''`)

    let data = null
    try {
      const json5 = await util.promisify(fs.readFile)(versionFilename, {
        encoding: "utf8",
      })
      data = JSON5.parse(json5)
    } catch (error) {
      this.log.error(`'${versionFilename}': ${error.message}`)
      return -1
    }

    let now: DateTime = null

    if (data.tags.tz) {
      now = DateTime.local().setZone(data.tags.tz)
    } else {
      this.log.warning("No 'tz' value set - using local time zone")
      now = DateTime.local()
    }
    const newMajorMinorPatch = args.increment !== "none"

    if (newMajorMinorPatch) {
      switch (args.increment) {
        case "major":
          data.tags.major += 1
          data.tags.minor = 0
          data.tags.patch = 0
          break
        case "minor":
          data.tags.minor += 1
          data.tags.patch = 0
          break
        case "patch":
          data.tags.patch += 1
          break
      }
    }

    if (args.sequence) {
      let sequence = data.tags.sequence || 0

      sequence += 1
      data.tags.sequence = sequence
    }

    let build

    switch (data.buildFormat) {
      case "jdate":
        build = StampVerTool.getJDate(now, data.startYear)

        if (newMajorMinorPatch || data.tags.build !== build) {
          data.tags.build = build
          data.tags.revision = 0
        } else {
          data.tags.revision += 1
        }
        break

      case "full":
        build = StampVerTool.getFullDate(now)

        if (newMajorMinorPatch || data.tags.build !== build) {
          data.tags.build = build
          data.tags.revision = 0
        } else {
          data.tags.revision += 1
        }
        break

      case "incr":
        if (newMajorMinorPatch) {
          data.tags.build = 0
        } else {
          data.tags.build += 1
        }
        data.tags.revision = 0
        break

      default:
        this.log.error(
          `Unknown build number format ${data.buildFormat}. Must be 'jdate', 'full' or 'incr'`
        )
        return -1
    }

    this.log.info("Tags are:")

    Object.entries(data.tags).forEach((arr) => {
      this.log.info(`  ${arr[0]}='${arr[1]}'`)
    })

    const versionDirname = path.dirname(versionFilename)

    this.log.info(`${args.update ? "Updating" : "Checking"} file list:`)

    for (const filename of data.filenames) {
      let match = false
      const fullFilename = path.resolve(path.join(versionDirname, filename))

      this.log.info(`  ${fullFilename}`)

      for (const fileType of data.fileTypes) {
        if (!minimatch(filename, fileType.glob, { dot: true })) {
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
            await util.promisify(fs.writeFile)(
              filename,
              StampVerTool.replaceTags(fileType.write, data.tags)
            )
          }
        } else {
          if (fs.existsSync(fullFilename)) {
            const updates = fileType.updates || [fileType.update]
            let content = await util.promisify(fs.readFile)(fullFilename, {
              encoding: "utf8",
            })

            updates.forEach((update) => {
              let found = false
              const replace = StampVerTool.replaceTags(
                update.replace,
                data.tags
              )
              const search = XRegExp(update.search, "m")
              content = XRegExp.replace(
                content,
                search,
                (match) => {
                  found = true
                  return StampVerTool.replaceTags(replace, match)
                },
                "one"
              )

              if (!found) {
                this.log.warning(
                  `File type '${fileType.name}' update '${update.search}' did not match anything`
                )
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
      await util.promisify(fs.writeFile)(
        versionFilename,
        JSON5.stringify(data, null, "  ")
      )
    }

    return 0
  }
}
