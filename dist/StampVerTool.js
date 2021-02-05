"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StampVerTool = void 0;
const minimist_1 = __importDefault(require("minimist"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const json5_1 = __importDefault(require("@johnls/json5"));
const version_1 = require("./version");
const xregexp_1 = __importDefault(require("xregexp"));
const minimatch_1 = __importDefault(require("minimatch"));
const util_1 = __importDefault(require("util"));
const moment_timezone_1 = __importDefault(require("moment-timezone"));
class StampVerTool {
    constructor(name, log) {
        this.name = name;
        this.log = log;
    }
    findVersionFile() {
        let dir = process.cwd();
        while (dir.length !== 0) {
            const filename = path_1.default.join(dir, "version.json5");
            if (fs_1.default.existsSync(filename)) {
                return filename;
            }
            else {
                dir = dir.substring(0, dir.lastIndexOf("/"));
            }
        }
        return null;
    }
    static getFullDate(now) {
        return now.year() * 10000 + (now.month() + 1) * 100 + now.date();
    }
    static getJDate(now, startYear) {
        return ((now.year() - startYear + 1) * 10000 +
            now.month() * 100 +
            now.date()).toString();
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
                str = str.substring(0, tagStart) +
                    tag +
                    str.substring(tagEnd + tagSuffix.length);
            }
            i = tagStart - 1;
        }
        return str;
    }
    run(argv) {
        return __awaiter(this, void 0, void 0, function* () {
            const options = {
                string: ["increment"],
                boolean: ["help", "version", "update", "sequence"],
                alias: {
                    u: "update",
                    i: "increment",
                    s: "sequence",
                },
                default: {
                    increment: "none",
                },
            };
            let args = minimist_1.default(argv, options);
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
                this.log.info(`${version_1.fullVersion}`);
                return 0;
            }
            let versionFn = args["_"].length > 0 ? args["_"][0] : null;
            if (versionFn && !fs_1.default.existsSync(versionFn)) {
                this.log.error(`Unable to find file '${versionFn}'`);
                return -1;
            }
            versionFn = this.findVersionFile();
            if (!versionFn) {
                this.log.error(`Unable to find version.json5 file in this or parent directories`);
                return -1;
            }
            versionFn = path_1.default.resolve(versionFn);
            if (this.versionFn && !fs_1.default.existsSync(this.versionFn)) {
                this.log.error(`File '${this.versionFn}' does not exist`);
                return -1;
            }
            this.log.info(`Version file is '${versionFn}''`);
            let data = null;
            try {
                const json5 = yield util_1.default.promisify(fs_1.default.readFile)(versionFn, {
                    encoding: "utf8",
                });
                data = json5_1.default.parse(json5);
            }
            catch (error) {
                this.log.error(`'${versionFn}': ${error.message}`);
                return -1;
            }
            let now = null;
            if (data.tags.tz) {
                now = moment_timezone_1.default().tz(data.tags.tz);
            }
            else {
                this.log.warning("No 'tz' value set - using local time zone");
                now = moment_timezone_1.default();
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
                    }
                    else {
                        data.tags.revision += 1;
                    }
                    break;
                case "full":
                    build = StampVerTool.getFullDate(now);
                    if (newMajorMinorPatch || data.tags.build !== build) {
                        data.tags.build = build;
                        data.tags.revision = 0;
                    }
                    else {
                        data.tags.revision += 1;
                    }
                    break;
                case "incr":
                    if (newMajorMinorPatch) {
                        data.tags.build = 0;
                    }
                    else {
                        data.tags.build += 1;
                    }
                    data.tags.revision = 0;
                    break;
                default:
                    this.log.error(`Unknown build number format ${data.buildFormat}. Must be 'jdate', 'full' or 'incr'`);
                    return -1;
            }
            this.log.info("Tags are:");
            Object.entries(data.tags).forEach((arr) => {
                this.log.info(`  ${arr[0]}='${arr[1]}'`);
            });
            const versionDirname = path_1.default.dirname(versionFn);
            this.log.info(`${args.update ? "Updating" : "Checking"} file list:`);
            for (let filename of data.filenames) {
                let match = false;
                const fullFilename = path_1.default.resolve(path_1.default.join(versionDirname, filename));
                this.log.info(`  ${fullFilename}`);
                for (let fileType of data.fileTypes) {
                    if (!minimatch_1.default(filename, fileType.glob, { dot: true })) {
                        continue;
                    }
                    match = true;
                    if (fileType.write) {
                        const dirname = path_1.default.dirname(fullFilename);
                        if (!fs_1.default.existsSync(dirname)) {
                            this.log.error(`Directory '${dirname}' does not exist`);
                            return -1;
                        }
                        if (args.update) {
                            yield util_1.default.promisify(fs_1.default.writeFile)(filename, StampVerTool.replaceTags(fileType.write, data.tags));
                        }
                    }
                    else {
                        if (fs_1.default.existsSync(fullFilename)) {
                            const updates = fileType.updates || [fileType.update];
                            let content = yield util_1.default.promisify(fs_1.default.readFile)(fullFilename, {
                                encoding: "utf8",
                            });
                            updates.forEach((update) => {
                                let found = false;
                                let replace = StampVerTool.replaceTags(update.replace, data.tags);
                                let search = xregexp_1.default(update.search, "m");
                                content = xregexp_1.default.replace(content, search, (match) => {
                                    found = true;
                                    return StampVerTool.replaceTags(replace, match);
                                }, "one");
                                if (!found) {
                                    this.log.warning(`File type '${fileType.name}' update '${update.search}' did not match anything`);
                                }
                            });
                            if (args.update) {
                                yield util_1.default.promisify(fs_1.default.writeFile)(fullFilename, content);
                            }
                        }
                        else {
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
                yield util_1.default.promisify(fs_1.default.writeFile)(versionFn, json5_1.default.stringify(data, null, "  "));
            }
            return 0;
        });
    }
}
exports.StampVerTool = StampVerTool;
//# sourceMappingURL=StampVerTool.js.map