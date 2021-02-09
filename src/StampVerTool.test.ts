import { StampVerTool } from "./StampVerTool"
import JSON5 from "@johnls/json5"
import { ScriptError } from "./ScriptError"
import path from "path"

let container = null

class CustomError extends Error {
  code: string

  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

beforeEach(() => {
  container = {
    toolName: "stampver",
    debug: false,
    log: {
      info: () => undefined,
      warning: () => undefined,
      error: () => undefined,
    },
  }
})

test("constructor", () => {
  const tool = new StampVerTool(container)

  // Happy path
  expect(tool).not.toBeNull()

  // Missing options
  expect(() => new StampVerTool({})).toThrowError("Must supply")
})

test("readScriptFile", async () => {
  container.fs = {
    readFile: async (fileName) => {
      switch (fileName) {
        case "/a/b/version.json5":
        case "/a/b/notthere.json":
          throw new CustomError("no such", "ENOENT")
        case "/a/version.json5":
        case "/a/b/somefile.json":
        default:
          return `{
            x: null,
            n: 1,
            b: true,
            o: {
              a: ["abc"]
            }
          }`
      }
    },
  }
  container.path = {
    resolve: (fileName) => "/a/b/" + fileName,
    join: (a, b) => a + "/" + b,
  }
  container.process = {
    cwd: () => "/a/b",
  }

  let tool = new StampVerTool(container)

  // Happy path - version file exists
  let result = await tool.readScriptFile("somefile.json")

  expect(result.scriptNode).not.toBeNull()
  expect(result.scriptFileName).toBe("/a/b/somefile.json")

  // Version specified and does not exist
  await expect(tool.readScriptFile("notthere.json")).rejects.toThrowError(
    "no such"
  )

  // No version file specified; look for one
  result = await tool.readScriptFile()
  expect(result.scriptNode).not.toBeNull()
  expect(result.scriptFileName).toBe("/a/version.json5")

  // No version file specified; look for one but no access
  container.fs = {
    readFile: async () => {
      throw new CustomError("access", "EACCES")
    },
  }
  tool = new StampVerTool(container)
  await expect(tool.readScriptFile()).rejects.toThrowError()

  // No version file and not found in parent dirs
  container.fs = {
    readFile: async () => {
      throw new CustomError("no such", "ENOENT")
    },
  }
  tool = new StampVerTool(container)
  await expect(tool.readScriptFile()).rejects.toThrowError()
})

test("validateScriptFile", () => {
  const parseNodes = (script) => JSON5.parse(script, { wantNodes: true })

  // Happy path
  const tool = new StampVerTool(container)
  let scriptNodes = parseNodes(`
  {
    vars: {
      major: 1,
      other: "something",
    },
    calcVars: {
      nextBuild: "now.year * 10000 + (now.month + 1) * 100 + now.day",
    },
    operations: {
      incrMajor: "major += 1; minor = 0; patch = 0; revision = 0; build = nextBuild",
    },
    targets: [
      {
        description: "Update target",
        files: ["package.json"],
        action: {
          updates: [
            {
              search: '^(?<begin> *"version" *: *")\\d+\\.\\d+\\.\\d+(?<end>" *, *)$',
              replace: '$\{begin}$\{major}.$\{minor}.$\{patch}$\{end}'
            },
          ],
        },
      },
      {
        description: "Write target",
        files: ["some-file.txt"],
        action: {
          write: "<some content>",
        }
      },
      {
        description: "Copy target",
        files: ["another-file.txt"],
        action: {
          copyFrom: "some-other-file.txt",
        }
      }
    ],
  }`)
  expect(() => tool.validateScriptFile(scriptNodes)).not.toThrowError()

  // Missing vars
  scriptNodes = parseNodes(`{
  }`)
  expect(() => tool.validateScriptFile(scriptNodes)).toThrowError(ScriptError)

  // Bad vars
  scriptNodes = parseNodes(`{
    vars: [],
  }`)
  expect(() => tool.validateScriptFile(scriptNodes)).toThrowError(ScriptError)

  // Bad tz
  scriptNodes = parseNodes(`{
    vars: { tz: 1 },
  }`)
  expect(() => tool.validateScriptFile(scriptNodes)).toThrowError(ScriptError)

  // Bad var type
  scriptNodes = parseNodes(`{
    vars: { a: null },
  }`)
  expect(() => tool.validateScriptFile(scriptNodes)).toThrowError(ScriptError)

  // Missing operations
  scriptNodes = parseNodes(`{
    vars: {},
  }`)
  expect(() => tool.validateScriptFile(scriptNodes)).toThrowError(ScriptError)

  // Bad operations
  scriptNodes = parseNodes(`{
    vars: {},
    operations: [],
  }`)
  expect(() => tool.validateScriptFile(scriptNodes)).toThrowError(ScriptError)

  // Bad calcVars
  scriptNodes = parseNodes(`{
    vars: {},
    calcVars: [],
  }`)
  expect(() => tool.validateScriptFile(scriptNodes)).toThrowError(ScriptError)

  // Bad calcVars type
  scriptNodes = parseNodes(`{
    vars: {},
    calcVars: { a: 1},
  }`)
  expect(() => tool.validateScriptFile(scriptNodes)).toThrowError(ScriptError)

  // Bad calcVars type
  scriptNodes = parseNodes(`{
    vars: {},
    operations: { a: 1},
  }`)
  expect(() => tool.validateScriptFile(scriptNodes)).toThrowError(ScriptError)

  // Missing targets
  scriptNodes = parseNodes(`{
    vars: {},
    operations: {},
  }`)
  expect(() => tool.validateScriptFile(scriptNodes)).toThrowError(ScriptError)

  // Bad targets
  scriptNodes = parseNodes(`{
    vars: {},
    operations: {},
    targets: {},
  }`)
  expect(() => tool.validateScriptFile(scriptNodes)).toThrowError(ScriptError)

  // Bad target item type
  scriptNodes = parseNodes(`{
    vars: {},
    operations: {},
    targets: [
      "x"
    ],
  }`)
  expect(() => tool.validateScriptFile(scriptNodes)).toThrowError(ScriptError)

  // Missing target desciption
  scriptNodes = parseNodes(`{
    vars: {},
    operations: {},
    targets: [
      {}
    ],
  }`)
  expect(() => tool.validateScriptFile(scriptNodes)).toThrowError(ScriptError)

  // Missing target files
  scriptNodes = parseNodes(`{
    vars: {},
    operations: {},
    targets: [
      {
        description: "",
      }
    ],
  }`)
  expect(() => tool.validateScriptFile(scriptNodes)).toThrowError(ScriptError)

  // Bad target files
  scriptNodes = parseNodes(`{
    vars: {},
    operations: {},
    targets: [
      {
        description: "",
        files: {}
      }
    ],
  }`)
  expect(() => tool.validateScriptFile(scriptNodes)).toThrowError(ScriptError)

  // Missing action
  scriptNodes = parseNodes(`{
    vars: {},
    operations: {},
    targets: [
      {
        description: "",
        files: ["x.txt"],
      }
    ],
  }`)
  expect(() => tool.validateScriptFile(scriptNodes)).toThrowError(ScriptError)

  // Bad action
  scriptNodes = parseNodes(`{
    vars: {},
    operations: {},
    targets: [
      {
        description: "",
        files: ["x.txt"],
        action: []
      }
    ],
  }`)
  expect(() => tool.validateScriptFile(scriptNodes)).toThrowError(ScriptError)

  // Bad updates
  scriptNodes = parseNodes(`{
    vars: {},
    operations: {},
    targets: [
      {
        description: "",
        files: ["x.txt"],
        action: {
          updates: []
        }
      }
    ],
  }`)
  expect(() => tool.validateScriptFile(scriptNodes)).toThrowError(ScriptError)

  // Bad updates item
  scriptNodes = parseNodes(`{
    vars: {},
    operations: {},
    targets: [
      {
        description: "",
        files: ["x.txt"],
        action: {
          updates: [1]
        }
      }
    ],
  }`)
  expect(() => tool.validateScriptFile(scriptNodes)).toThrowError(ScriptError)

  // Missing updates replace
  scriptNodes = parseNodes(`{
    vars: {},
    operations: {},
    targets: [
      {
        description: "",
        files: ["x.txt"],
        action: {
          updates: [
            {
              search: "something",
            }
          ]
        }
      }
    ],
  }`)
  expect(() => tool.validateScriptFile(scriptNodes)).toThrowError(ScriptError)

  // Bad write
  scriptNodes = parseNodes(`{
    vars: {},
    operations: {},
    targets: [
      {
        description: "",
        files: ["x.txt"],
        action: {
          write: 1,
        }
      }
    ],
  }`)
  expect(() => tool.validateScriptFile(scriptNodes)).toThrowError(ScriptError)

  // Bad copyFrom
  scriptNodes = parseNodes(`{
    vars: {},
    operations: {},
    targets: [
      {
        description: "",
        files: ["x.txt"],
        action: {
          copyFrom: 1,
        }
      }
    ],
  }`)
  expect(() => tool.validateScriptFile(scriptNodes)).toThrowError(ScriptError)

  // Bad action
  scriptNodes = parseNodes(`{
    vars: {},
    operations: {},
    targets: [
      {
        description: "",
        files: ["x.txt"],
        action: {
          unknown: 1,
        }
      }
    ],
  }`)
  expect(() => tool.validateScriptFile(scriptNodes)).toThrowError(ScriptError)
})

test("createRunContext", () => {
  Object.assign(container, {
    vm: {
      createContext: (obj) => obj,
      Script: class {
        script: string
        constructor(script: string) {
          this.script = script
        }
        runInContext(_) {
          if (this.script === "{throw}") {
            throw new Error("Bad script")
          } else {
            return this.script
          }
        }
      },
    },
  })
  const parseNodes = (script) => JSON5.parse(script, { wantNodes: true })

  // Happy path
  const tool = new StampVerTool(container)
  let scriptNodes = parseNodes(`
  {
    vars: {
      major: 1,
      other: "something",
    },
    calcVars: {
      nextBuild: "now.year * 10000 + (now.month + 1) * 100 + now.day",
    },
  }`)
  let result = tool.createRunContext(scriptNodes)

  expect(result.runContext).not.toBeNull()
  expect(result.interpolator).not.toBeNull()
  expect(
    result.interpolator({ line: 1, column: 1, type: "string", value: "{x}" })
  ).toBe("{x}")
  expect(() =>
    result.interpolator({
      line: 1,
      column: 1,
      type: "string",
      value: "{throw}",
    })
  ).toThrowError(ScriptError)

  // With tz
  scriptNodes = parseNodes(`
  {
    vars: {
      major: 1,
      tz: "Americas/Something",
    },
  }`)
  result = tool.createRunContext(scriptNodes)

  expect(result.runContext).not.toBeNull()
  expect(result.runContext.tz).toBe("Americas/Something")
  expect(result.interpolator).not.toBeNull()

  // Would overwrite var
  scriptNodes = parseNodes(`
  {
    vars: {
      major: 1,
    },
    calcVars: {
      major: "",
    }
  }`)
  expect(() => tool.createRunContext(scriptNodes)).toThrowError(ScriptError)
})

test("runOperation", () => {
  const parseNodes = (script) => JSON5.parse(script, { wantNodes: true })

  // Happy path
  const tool = new StampVerTool(container)
  const scriptNode = parseNodes(`
  {
    operations: {
      incrMajor: "{minor += 1}",
    },
  }`)

  expect(tool.runOperation("incrMajor", (s) => s, scriptNode)).toBeUndefined()

  // Missing operation
  expect(() => tool.runOperation("otherOp", (s) => s, scriptNode)).toThrowError(
    ScriptError
  )
})

test("processTargets", async () => {
  const parseNodes = (script) => JSON5.parse(script, { wantNodes: true })
  const XRegExp = function (search) {
    return { value: search }
  }

  XRegExp.replace = (content, search, match) => {
    if (search.value !== "notfound") {
      match({ before: "", after: "" })
    }
  }

  Object.assign(container, {
    path: {
      dirname: (fileName) => path.dirname(fileName),
      join: (a, b) => path.join(a, b),
    },
    fs: {
      writeFile: () => undefined,
      readFile: () => "{}",
      copyFile: () => undefined,
    },
    XRegExp,
  })
  // Happy path
  const tool = new StampVerTool(container)
  const scriptNode = parseNodes(`
  {
    targets: [
      {
        description: "",
        files: ["a.txt"],
        action: {
          updates: [
            {
              search: "x",
              replace: "y",
            },
            {
              search: "notfound",
              replace: "y",
            }
          ]
        }
      },
      {
        description: "",
        files: ["b.txt"],
        action: {
          write: "c.txt"
        }
      },
      {
        description: "",
        files: ["z.txt"],
        action: {
          copyFrom: "y.txt"
        }
      }
    ],
  }`)
  const interpolator = (x) => x

  await expect(
    tool.processTargets("/a/b/version.json", {}, interpolator, scriptNode, true)
  )

  // No update
  await expect(
    tool.processTargets(
      "/a/b/version.json",
      {},
      interpolator,
      scriptNode,
      false
    )
  )
})

test("updateScriptFile", async () => {
  // Happy path
  Object.assign(container, {
    fs: {
      writeFile: async () => undefined,
    },
  })
  const parseNodes = (script) => JSON5.parse(script, { wantNodes: true })

  // Happy path
  const tool = new StampVerTool(container)
  const scriptNodes = parseNodes(`
  {
    vars: {
      major: 1,
      other: "something",
    },
    calcVars: {
      nextBuild: "now.year * 10000 + (now.month + 1) * 100 + now.day",
    },
  }`)

  await expect(
    tool.updateScriptFile("version.json", scriptNodes, {
      major: 1,
      other: "something",
    })
  ).resolves.toBeUndefined()
})

test("run", async () => {
  // Happy path
  const tool = new StampVerTool(container)

  tool.validateScriptFile = () => undefined
  tool.createRunContext = () => ({
    runContext: { a: 1, b: 1, env: {}, now: {} },
    interpolator: (x) => x,
  })
  tool.runOperation = () => undefined
  tool.processTargets = async () => undefined
  tool.updateScriptFile = async () => undefined

  await expect(tool.run(["-u", "version.json"])).resolves.toBe(0)

  // No update
  await expect(tool.run(["version.json"])).resolves.toBe(0)

  // With tz
  tool.createRunContext = () => ({
    runContext: { a: 1, b: 1, tz: "Americas/Somewhere", env: {}, now: {} },
    interpolator: (x) => x,
  })

  await expect(tool.run(["version.json"])).resolves.toBe(0)

  // Version
  await expect(tool.run(["--version"])).resolves.toBe(0)

  // Help
  await expect(tool.run(["--help"])).resolves.toBe(0)
})
