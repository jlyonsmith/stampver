import { ScriptError } from "./ScriptError"

test("constructor", async () => {
  // Happy path
  let error = new ScriptError("message", {
    fileName: "xyz.json",
    line: 1,
    column: 1,
  })

  expect(error.toString()).toBe(error.message)

  // No file
  error = new ScriptError("message", {
    line: 1,
    column: 1,
  })

  expect(error.toString()).toBe(error.message)
})
