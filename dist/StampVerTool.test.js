"use strict";

var _StampVerTool = require("./StampVerTool");

var _tmp = _interopRequireDefault(require("tmp"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

let tmpDirObj = null;
beforeAll(() => {
  tmpDirObj = _tmp.default.dirSync();
});
afterAll(() => {
  if (tmpDirObj) {
    tmpDirObj.removeCallback();
  }
});

function getMockLog() {
  return {
    info: jest.fn(),
    warning: jest.fn(),
    error: jest.fn()
  };
}

function getOutput(fn) {
  const calls = fn.mock.calls;

  if (calls.length > 0 && calls[0].length > 0) {
    return calls[0][0];
  } else {
    return "";
  }
}

test("test help", done => {
  const mockLog = getMockLog();
  const tool = new _StampVerTool.StampVerTool(mockLog);
  return tool.run(["--help"]).then(exitCode => {
    expect(exitCode).toBe(0);
    expect(getOutput(mockLog.info)).toEqual(expect.stringContaining("--help"));
    done();
  });
});
test("test version", done => {
  const mockLog = getMockLog();
  const tool = new _StampVerTool.StampVerTool(mockLog);
  return tool.run(["--version"]).then(exitCode => {
    expect(exitCode).toBe(0);
    expect(getOutput(mockLog.info)).toEqual(expect.stringMatching(/^v/));
    done();
  });
});
//# sourceMappingURL=StampVerTool.test.js.map