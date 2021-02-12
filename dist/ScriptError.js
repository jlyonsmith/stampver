"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScriptError = void 0;
class ScriptError extends Error {
    constructor(message, node) {
        super(message);
        if (node.fileName) {
            this.message += ` (${node.fileName}:${node.line}:${node.column})`;
        }
        else {
            this.message += ` (${node.line}:${node.column})`;
        }
    }
    // Otherwise "Error: " is prefixed
    toString() {
        return this.message;
    }
}
exports.ScriptError = ScriptError;
//# sourceMappingURL=ScriptError.js.map