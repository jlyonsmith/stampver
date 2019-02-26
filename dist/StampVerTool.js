"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.StampVerTool = void 0;

var _minimist = _interopRequireDefault(require("minimist"));

var _fs = _interopRequireDefault(require("fs"));

var _path = _interopRequireDefault(require("path"));

var _json = _interopRequireDefault(require("json5"));

var _version = require("./version");

var _xregexp = _interopRequireDefault(require("xregexp"));

var _minimatch = _interopRequireDefault(require("minimatch"));

var _util = _interopRequireDefault(require("util"));

var _momentTimezone = _interopRequireDefault(require("moment-timezone"));

var _autobindDecorator = _interopRequireDefault(require("autobind-decorator"));

var _class;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

let StampVerTool = (0, _autobindDecorator.default)(_class = class StampVerTool {
  constructor(name, log) {
    this.name = name;
    this.log = log;
  }

  findVersionFile() {
    let dir = process.cwd();

    while (dir.length !== 0) {
      const filename = _path.default.join(dir, "version.json5");

      if (_fs.default.existsSync(filename)) {
        return filename;
      } else {
        dir = dir.substring(0, dir.lastIndexOf("/"));
      }
    }

    return null;
  }

  static getFullDate(now) {
    return now.year() * 10000 + (now.month() + 1) * 100 + now.date();
  }

  static getJDate(now, startYear) {
    return ((now.year() - startYear + 1) * 10000 + now.month() * 100 + now.date()).toString();
  }

  static replaceTags(str, tags) {
    const tagPrefix = "${";
    const tagSuffix = "}";

    for (let i = str.length - 1; i != -1;) {
      const tagEnd = str.lastIndexOf(tagSuffix, i);

      if (tagEnd <= 0) {
        break;
      }

      const tagStart = str.lastIndexOf(tagPrefix, tagEnd - 1);

      if (tagStart < 0) {
        break;
      }

      const key = str.substring(tagStart + tagPrefix.length, tagEnd);
      const tag = tags[key];

      if (typeof tag !== "undefined") {
        str = str.substring(0, tagStart) + tag + str.substring(tagEnd + tagSuffix.length);
      }

      i = tagStart - 1;
    }

    return str;
  }

  async run(argv) {
    const options = {
      string: ["increment"],
      boolean: ["help", "version", "update", "sequence"],
      alias: {
        u: "update",
        i: "increment",
        s: "sequence"
      },
      default: {
        increment: "none"
      }
    };
    let args = (0, _minimist.default)(argv, options);

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
`);
      return 0;
    }

    if (args.version) {
      this.log.info(`${_version.fullVersion}`);
      return 0;
    }

    let versionFn = args["_"].length > 0 ? args["_"][0] : null;

    if (versionFn && !_fs.default.existSync(versionFn)) {
      this.log.error(`Unable to find file '${versionFn}'`);
      return -1;
    }

    versionFn = this.findVersionFile();

    if (!versionFn) {
      this.log.error(`Unable to find version.json5 file in this or parent directories`);
      return -1;
    }

    versionFn = _path.default.resolve(versionFn);

    if (this.versionFn && !_fs.default.existsSync(this.versionFn)) {
      this.log.error(`File '${this.versionFn}' does not exist`);
      return -1;
    }

    this.log.info(`Version file is '${versionFn}''`);
    let data = null;

    try {
      const json5 = await _util.default.promisify(_fs.default.readFile)(versionFn, {
        encoding: "utf8"
      });
      data = _json.default.parse(json5);
    } catch (error) {
      this.log.error(`'${versionFn}': ${error.message}`);
      return -1;
    }

    let now = null;

    if (data.tags.tz) {
      now = (0, _momentTimezone.default)().tz(data.tags.tz);
    } else {
      this.log.warning("No 'tz' value set - using local time zone");
      now = (0, _momentTimezone.default)();
    }

    const newMajorMinorPatch = args.increment !== "none";
    let build;

    if (newMajorMinorPatch) {
      switch (args.increment) {
        case "major":
          data.tags.major += 1;
          data.tags.minor = 0;
          data.tags.patch = 0;
          break;

        case "minor":
          data.tags.minor += 1;
          data.tags.patch = 0;
          break;

        case "patch":
          data.tags.patch += 1;
          break;
      }
    }

    if (args.sequence) {
      let sequence = data.tags.sequence || 0;
      sequence += 1;
      data.tags.sequence = sequence;
    }

    switch (data.buildFormat) {
      case "jdate":
        build = StampVerTool.getJDate(now, data.startYear);

        if (newMajorMinorPatch || data.tags.build !== build) {
          data.tags.build = build;
          data.tags.revision = 0;
        } else {
          data.tags.revision += 1;
        }

        break;

      case "full":
        build = StampVerTool.getFullDate(now);

        if (newMajorMinorPatch || data.tags.build !== build) {
          data.tags.build = build;
          data.tags.revision = 0;
        } else {
          data.tags.revision += 1;
        }

        break;

      case "incr":
        if (newMajorMinorPatch) {
          data.tags.build = 0;
        } else {
          data.tags.build += 1;
        }

        data.tags = revision = 0;
        break;

      default:
        this.log.error(`Unknown build number format ${data.buildFormat}. Must be 'jdate', 'full' or 'incr'`);
        return -1;
    }

    this.log.info("Tags are:");
    Object.entries(data.tags).forEach(arr => {
      this.log.info(`  ${arr[0]}='${arr[1]}'`);
    });

    const versionDirname = _path.default.dirname(versionFn);

    this.log.info(`${args.update ? "Updating" : "Checking"} file list:`);

    for (let filename of data.filenames) {
      let match = false;

      const fullFilename = _path.default.resolve(_path.default.join(versionDirname, filename));

      this.log.info(`  ${fullFilename}`);

      for (let fileType of data.fileTypes) {
        if (!(0, _minimatch.default)(filename, fileType.glob, {
          dot: true
        })) {
          continue;
        }

        match = true;

        if (fileType.write) {
          const dirname = _path.default.dirname(fullFilename);

          if (!_fs.default.existsSync(dirname)) {
            this.log.error(`Directory '${dirname}' does not exist`);
            return -1;
          }

          if (args.update) {
            await _util.default.promisify(_fs.default.writeFile)(filename, StampVerTool.replaceTags(fileType.write, data.tags));
          }
        } else {
          if (_fs.default.existsSync(fullFilename)) {
            const updates = fileType.updates || [fileType.update];
            let content = await _util.default.promisify(_fs.default.readFile)(fullFilename, {
              encoding: "utf8"
            });
            updates.forEach(update => {
              let found = false;
              let replace = StampVerTool.replaceTags(update.replace, data.tags);
              let search = new _xregexp.default(update.search, "m");
              content = _xregexp.default.replace(content, search, match => {
                found = true;
                return StampVerTool.replaceTags(replace, match);
              }, "one");

              if (!found) {
                this.log.warning(`File type '${fileType.name}' update '${update.search}' did not match anything`);
              }
            });

            if (args.update) {
              await _util.default.promisify(_fs.default.writeFile)(fullFilename, content);
            }
          } else {
            this.log.error(`File '${fullFilename}' does not exist to update`);
            return -1;
          }
        }

        if (match) {
          break;
        }
      }

      if (!match) {
        this.log.error(`File '${fullFilename}' has no matching file type`);
        continue;
      }
    }

    if (args.update) {
      await _util.default.promisify(_fs.default.writeFile)(versionFn, _json.default.stringify(data, null, "  "));
    }

    return 0;
  }

}) || _class;

exports.StampVerTool = StampVerTool;
//# sourceMappingURL=StampVerTool.js.map