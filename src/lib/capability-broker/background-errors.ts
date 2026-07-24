export function reportBackgroundBrokerError(message: string, cause: unknown): void {
  reportError(Object.assign(new Error(message), { cause }));
}
