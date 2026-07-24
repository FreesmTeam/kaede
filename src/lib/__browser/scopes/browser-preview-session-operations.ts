export type BrowserSessionOperationRunner = <Result>(
  operation: () => Promise<Result>,
) => Promise<Result>;

export type BrowserSessionOperationBarrier = Readonly<{
  "requireActive": () => void;
  "run"          : BrowserSessionOperationRunner;
  "revoke"       : () => Promise<Readonly<{ "alreadyRevoked": boolean }>>;
}>;

export function createBrowserSessionOperationBarrier(
  pluginId: string,
  onRevoke: () => void,
): BrowserSessionOperationBarrier {
  const inFlight = new Set<Promise<void>>;
  let revoked = false;
  const requireActive = (): void => {
    if (revoked) {
      throw new Error(`Plugin capability session has been revoked: ${pluginId}`);
    }
  };
  const run: BrowserSessionOperationRunner = <Result>(
    operation: () => Promise<Result>,
  ): Promise<Result> => {
    try {
      requireActive();
    } catch (error: unknown) {
      return Promise.reject(error);
    }

    let settleBarrier: (() => void) | undefined;
    const operationBarrier = new Promise<void>(resolve => {
      settleBarrier = resolve;
    });

    inFlight.add(operationBarrier);

    return (async (): Promise<Result> => {
      try {
        const result = await operation();

        requireActive();

        return result;
      } finally {
        inFlight.delete(operationBarrier);
        settleBarrier?.();
      }
    })();
  };
  const revoke = async (): Promise<Readonly<{ "alreadyRevoked": boolean }>> => {
    const alreadyRevoked = revoked;

    if (!revoked) {
      revoked = true;
      onRevoke();
    }

    await Promise.all(inFlight);

    return Object.freeze({ alreadyRevoked });
  };

  return Object.freeze({ requireActive, run, revoke });
}
