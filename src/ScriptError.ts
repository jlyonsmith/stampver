export class ScriptError extends Error {
  constructor(message: string, node: any) {
    super(message)

    if (node.fileName) {
      this.message += ` (${node.fileName}:${node.line}:${node.column})`
    } else {
      this.message += ` (${node.line}:${node.column})`
    }
  }

  // Otherwise "Error: " is prefixed
  toString(): string {
    return this.message
  }
}
