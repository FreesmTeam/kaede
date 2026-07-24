export class UnsupportedInBrowserPreviewError extends Error {
  public constructor(capability: string) {
    super(`${capability} is unsupported in browser preview`);
    this.name = "UnsupportedInBrowserPreviewError";
  }
}

export class CapabilityBrokerNotInitializedError extends Error {
  public constructor() {
    super("The capability broker has not been initialized");
    this.name = "CapabilityBrokerNotInitializedError";
  }
}

export class UnexpectedBrokerResponseError extends Error {
  public constructor(expected: string, actual: string) {
    const message = `Expected broker response ${JSON.stringify(expected)}, ` +
      `received ${JSON.stringify(actual)}`;

    super(message);
    this.name = "UnexpectedBrokerResponseError";
  }
}

export class UnsupportedBrokerOperationError extends Error {
  public constructor(operation: string) {
    super(`${operation} is not implemented by the current capability broker contract`);
    this.name = "UnsupportedBrokerOperationError";
  }
}
