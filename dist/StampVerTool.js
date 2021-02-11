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
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const process_1 = __importDefault(require("process"));
const vm_1 = __importDefault(require("vm"));
const json5_1 = __importDefault(require("@johnls/json5"));
const version_1 = require("./version");
const xregexp_1 = __importDefault(require("xregexp"));
const luxon_1 = require("luxon");
const ScriptError_1 = require("./ScriptError");
class StampVerTool {
    constructor(options) {
        this.toolName = options.toolName;
        this.log = options.log;
        if (!this.toolName || !this.log) {
            throw new Error("Must supply toolName and log");
        }
        this.fs = options.fs || promises_1.default;
        this.path = options.path || path_1.default;
        this.process = options.process || process_1.default;
        this.vm = options.vm || vm_1.default;
        this.XRegExp = options.XRegExp || xregexp_1.default;
    }
    readScriptFile(fileName) {
        return __awaiter(this, void 0, void 0, function* () {
            let content = null;
            if (fileName) {
                fileName = this.path.resolve(fileName);
                content = yield this.fs.readFile(fileName);
            }
            else {
                const baseName = "version.json5";
                let dirName = this.process.cwd();
                for (;;) {
                    fileName = this.path.join(dirName, baseName);
                    try {
                        content = yield this.fs.readFile(fileName, {
                            encoding: "utf8",
                        });
                        break;
                    }
                    catch (error) {
                        if (error.code !== "ENOENT") {
                            throw error;
                        }
                        // Try the parent directory
                        dirName = dirName.substring(0, dirName.lastIndexOf("/"));
                        if (dirName.length === 0) {
                            break;
                        }
                    }
                }
                if (content === null) {
                    throw new Error(`No '${baseName}' file found in current directory or parent directories`);
                }
            }
            const scriptNode = json5_1.default.parse(content, { wantNodes: true });
            const addFileName = (node) => {
                node.filename = fileName;
                switch (node.type) {
                    case "null":
                    case "numeric":
                    case "boolean":
                    case "string":
                        break;
                    case "object":
                        for (const [_, value] of Object.entries(node.value)) {
                            addFileName(value);
                        }
                        break;
                    case "array":
                        for (const value of node.value) {
                            addFileName(value);
                        }
                        break;
                }
            };
            addFileName(scriptNode);
            return {
                scriptNode,
                scriptFileName: fileName,
            };
        });
    }
    validateScriptFile(scriptNode) {
        const { vars: varsNode, calcVars: calcVarsNode, operations: operationsNode, targets: targetsNode, } = scriptNode.value;
        // vars node
        if (!varsNode || varsNode.type !== "object") {
            throw new ScriptError_1.ScriptError("Must have a 'vars' object", varsNode !== null && varsNode !== void 0 ? varsNode : scriptNode);
        }
        for (const key of Object.keys(varsNode.value)) {
            const varNode = varsNode.value[key];
            if (key === "tz" && varNode.type !== "string") {
                throw new ScriptError_1.ScriptError("'tz' variable must be a string", varNode);
            }
            else if (varNode.type !== "string" && varNode.type !== "numeric") {
                throw new ScriptError_1.ScriptError(`'var' entry '${key}' must be a number or a string`, varNode);
            }
        }
        // calcVars node
        if (calcVarsNode) {
            if (calcVarsNode.type !== "object") {
                throw new ScriptError_1.ScriptError("'calcVars' must be an object", calcVarsNode);
            }
            for (const key of Object.keys(calcVarsNode.value)) {
                const calcVarNode = calcVarsNode.value[key];
                if (calcVarNode.type !== "string") {
                    throw new ScriptError_1.ScriptError(`'calcVars' entry '${key}' must be a string`, calcVarNode);
                }
            }
        }
        // operations node
        if (!operationsNode || operationsNode.type !== "object") {
            throw new ScriptError_1.ScriptError("Must have an 'operations' object", operationsNode !== null && operationsNode !== void 0 ? operationsNode : scriptNode);
        }
        for (const key of Object.keys(operationsNode.value)) {
            const operationNode = operationsNode.value[key];
            if (operationNode.type !== "string") {
                throw new ScriptError_1.ScriptError(`'operations' entry '${key}' must be a string`, operationNode);
            }
        }
        // targets node
        if (!targetsNode ||
            targetsNode.type !== "array" ||
            targetsNode.value.length === 0) {
            throw new ScriptError_1.ScriptError("Must have a non-zero 'targets' array", targetsNode !== null && targetsNode !== void 0 ? targetsNode : scriptNode);
        }
        for (const key of Object.keys(targetsNode.value)) {
            const targetNode = targetsNode.value[key];
            if (targetNode.type !== "object") {
                throw new ScriptError_1.ScriptError(`'targets' entry '${key}' must be an object`, targetNode);
            }
            const { description: descriptionNode, files: filesNode, action: actionNode, } = targetNode.value;
            if (!descriptionNode || descriptionNode.type !== "string") {
                throw new ScriptError_1.ScriptError("Target must have a 'description' string", targetsNode);
            }
            if (!filesNode ||
                filesNode.type !== "array" ||
                filesNode.value.length === 0) {
                throw new ScriptError_1.ScriptError("Target must have a non-zero 'files' array", filesNode !== null && filesNode !== void 0 ? filesNode : targetsNode);
            }
            if (!actionNode || actionNode.type !== "object") {
                throw new ScriptError_1.ScriptError("Target must have an 'action' object", targetsNode);
            }
            const { updates: updatesNode, write: writeNode, copyFrom: copyFromNode, } = actionNode.value;
            if (updatesNode) {
                if (updatesNode.type !== "array" || updatesNode.value.length == 0) {
                    throw new ScriptError_1.ScriptError("'updates' must be a non-zero length array", updatesNode);
                }
                for (const itemNode of updatesNode.value) {
                    if (itemNode.type !== "object") {
                        throw new ScriptError_1.ScriptError("'updates' entry must be an object", itemNode);
                    }
                    const { search: searchNode, replace: replaceNode } = itemNode.value;
                    if (!(searchNode && searchNode.type === "string") ||
                        !(replaceNode && replaceNode.type === "string")) {
                        throw new ScriptError_1.ScriptError("'updates' item must have 'search' and 'replace' properties", itemNode);
                    }
                }
            }
            else if (writeNode) {
                if (writeNode.type !== "string") {
                    throw new ScriptError_1.ScriptError("'write' must be a string", writeNode);
                }
            }
            else if (copyFromNode) {
                if (copyFromNode.type !== "string") {
                    throw new ScriptError_1.ScriptError("'copyFrom' must be a string", copyFromNode);
                }
            }
            else {
                throw new ScriptError_1.ScriptError("'action' must be 'updates', 'write' or 'copyFrom'", actionNode);
            }
        }
    }
    createRunContext(scriptNode) {
        const { vars: varsNode, calcVars: calcVarsNode } = scriptNode.value;
        const vars = {};
        for (const key of Object.keys(varsNode.value)) {
            const varNode = varsNode.value[key];
            vars[key] = varNode.value;
        }
        const runContext = this.vm.createContext(Object.assign(Object.assign({}, vars), { env: Object.assign({}, this.process.env) }));
        const interpolator = (node) => {
            if (node.value.startsWith("{") && node.value.endsWith("}")) {
                try {
                    return new this.vm.Script(node.value).runInContext(runContext);
                }
                catch (e) {
                    throw new ScriptError_1.ScriptError(`Bad script - ${e.message}`, node);
                }
            }
            else {
                return node.value;
            }
        };
        const now = luxon_1.DateTime.local();
        if (runContext.tz) {
            now.setZone(runContext.tz);
        }
        runContext.now = {
            year: now.year,
            month: now.month,
            day: now.day,
            hour: now.hour,
            minute: now.minute,
            second: now.second,
            zoneName: now.zoneName,
        };
        if (calcVarsNode) {
            for (const key of Object.keys(calcVarsNode.value)) {
                const calcVarNode = calcVarsNode.value[key];
                if (runContext[key] !== undefined) {
                    throw new ScriptError_1.ScriptError(`'calcVars' entry '${key}' would overwrite existing value '${runContext[key]}'`, calcVarNode);
                }
                runContext[key] = interpolator(calcVarNode);
            }
        }
        return { runContext, interpolator };
    }
    runOperation(operation, interpolator, scriptNode) {
        if (!operation) {
            throw new Error("An operation argument must be specified");
        }
        const { operations: operationsNode } = scriptNode.value;
        const operationNode = operationsNode.value[operation];
        if (!operationNode) {
            throw new ScriptError_1.ScriptError(`'operations' entry '${operation}' does not exist`, operationsNode);
        }
        interpolator(operationNode);
    }
    processTargets(scriptFileName, runContext, interpolator, scriptNode, update) {
        return __awaiter(this, void 0, void 0, function* () {
            const rootDirName = this.path.dirname(scriptFileName);
            const { targets: targetsNode } = scriptNode.value;
            for (const targetNode of targetsNode.value) {
                const { files: filesNode, description: descriptionNode, action: actionNode, } = targetNode.value;
                const { updates: updatesNode, write: writeNode, copyFrom: copyFromNode, } = actionNode.value;
                for (const fileNode of filesNode.value) {
                    const fileName = this.path.join(rootDirName, fileNode.value);
                    this.log.info(`  ${fileName} (${descriptionNode.value})`);
                    if (updatesNode) {
                        for (const updateNode of updatesNode.value) {
                            const { search: searchNode, replace: replaceNode, } = updateNode.value;
                            const search = this.XRegExp(searchNode.value, "m");
                            const captureNames = search.xregexp.captureNames;
                            captureNames.forEach((name) => {
                                if (runContext[name] !== undefined) {
                                    throw new Error(`Capture name '${name}' conflicts with existing variable`);
                                }
                            });
                            let content = yield this.fs.readFile(fileName, { encoding: "utf8" });
                            let found = false;
                            content = this.XRegExp.replace(content, search, (match) => {
                                found = true;
                                captureNames.forEach((name) => (runContext[name] = match[name]));
                                return interpolator(replaceNode);
                            }, "one");
                            if (!found) {
                                this.log.warning(`Search/replace on '${fileName}' did not match anything; check your search string`);
                            }
                            captureNames.forEach((name) => (runContext[name] = undefined));
                            if (update) {
                                yield this.fs.writeFile(fileName, content);
                            }
                        }
                    }
                    else if (writeNode && update) {
                        yield this.fs.writeFile(fileName, interpolator(writeNode));
                    }
                    else if (copyFromNode && update) {
                        yield this.fs.copyFile(interpolator(copyFromNode.value), fileName);
                    }
                }
            }
        });
    }
    updateScriptFile(scriptFileName, scriptNode, runContext) {
        return __awaiter(this, void 0, void 0, function* () {
            const script = json5_1.default.simplify(scriptNode);
            for (const key of Object.keys(script.vars)) {
                script.vars[key] = runContext[key];
            }
            yield this.fs.writeFile(scriptFileName, json5_1.default.stringify(script, null, "  "));
        });
    }
    run(argv) {
        return __awaiter(this, void 0, void 0, function* () {
            const options = {
                string: ["increment"],
                boolean: ["help", "version", "update", "sequence", "debug", "input"],
                alias: {
                    u: "update",
                    i: "input",
                    s: "sequence",
                },
                default: {
                    increment: "none",
                },
            };
            const args = minimist_1.default(argv, options);
            if (args.help) {
                this.log.info(`
Version stamping tool

Usage:
        ${this.toolName} [-u | --update] [--debug] [-i | --input <file>] <operation>
        ${this.toolName} [--help | --version]

Performs version <operation> as specified in the project version file.  The exact
operation is user defined but typically increments a version number.

<version-file> defaults to 'version.json5' in the current or any parent directory.

Uses the version file as the root directory for non-absolute files.

See https://github.com/jlyonsmith/stampver for full documentation, including the
format of the version.json5 file.

Options:

-i                Specify version file explicitly. Default is **/version.json5
-u, --update      Actually do the file updates. Default is to dry run.
--help            Displays this help
--version         Displays tool version
--debug           Give additional debugging information
`);
                return 0;
            }
            if (args.version) {
                this.log.info(`${version_1.fullVersion}`);
                return 0;
            }
            this.debug = args.debug;
            const { scriptNode, scriptFileName } = yield this.readScriptFile(args.input);
            this.log.info(`Using versioning script '${scriptFileName}'`);
            this.validateScriptFile(scriptNode);
            const { runContext, interpolator } = this.createRunContext(scriptNode);
            if (!runContext.tz) {
                this.log.warning("No 'tz' timezone value set; using local time zone '${now.zoneName}'");
            }
            this.log.info("Variables are:");
            for (const key of Object.keys(runContext)) {
                if (key === "env" || key === "now") {
                    continue;
                }
                this.log.info(`  ${key}='${runContext[key]}'`);
            }
            this.log.info(`${args.update ? "Updating" : "Dry run update of"} target files:`);
            this.runOperation(args._[0], interpolator, scriptNode);
            yield this.processTargets(scriptFileName, runContext, interpolator, scriptNode, args.update);
            if (args.update) {
                this.log.info(`Writing ${scriptFileName}`);
                yield this.updateScriptFile(scriptFileName, scriptNode, runContext);
            }
            return 0;
        });
    }
}
exports.StampVerTool = StampVerTool;
//# sourceMappingURL=StampVerTool.js.map