export interface Logger {
  info(...params: string[])
  error(...params: string[])
  warning(...params: string[])
}
