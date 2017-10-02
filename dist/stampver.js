'use strict';

var _minimist = require('minimist');

var _minimist2 = _interopRequireDefault(_minimist);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class StampVer {
  run() {
    return Promise.resolve(0);
  }
}

const stampVer = new StampVer(console);
stampVer.run(process.argv.slice(2)).then(exitCode => {
  process.exit(exitCode);
}).catch(err => {
  console.error(err);
});
//# sourceMappingURL=stampver.js.map