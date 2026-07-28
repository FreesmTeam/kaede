export function reportBackgroundBrokerError(message: string, cause: unknown): void {
  const error = new Error(message);

  Object.defineProperty(error, "cause", {
    "configurable": true,
    "value"       : cause,
    "writable"    : true,
  });
  reportError(error);
}
