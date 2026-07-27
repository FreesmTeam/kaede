import { AsyncFunction } from "@/constants/application-primitives.ts";
import type { KaedeNamespaceType } from "@/declarations.ts";
import type {
  DirectHostFacade,
  HostFacade,
} from "@/lib/capability-broker";
import Errors from "@/lib/errors";
import { log } from "@/lib/logging/scopes/log.ts";

export type TrustedExtensionContext = Readonly<{
  "Host"      : HostFacade;
  "DirectHost": DirectHostFacade;
  "Kaede"     : KaedeNamespaceType;
}>;

export type RunInUnrestrictedOptions = Readonly<{
  "id"     : string;
  "code"   : string;
  "context": TrustedExtensionContext;
}>;

type TrustedExtensionFunction = (
  this: TrustedExtensionContext,
  scopedThis: TrustedExtensionContext,
) => Promise<unknown>;

export async function runInUnrestricted({
  id,
  code,
  context,
}: RunInUnrestrictedOptions): Promise<void> {
  const startTime = performance.now();

  log.debug(__PRE_BUNDLED_FILENAME__, `Initializing the '${id}' extension code`);

  const compiled = new AsyncFunction("scopedThis", code) as TrustedExtensionFunction;

  log.debug(
    __PRE_BUNDLED_FILENAME__,
    `Executing the '${id}' extension code in the unrestricted environment`,
  );

  try {
    await Reflect.apply(compiled, context, [context]);
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      `Failed to execute the '${id}' extension code in the unrestricted environment:`,
      Errors.prettify(error),
    );

    throw error;
  }

  const timeDifference = (performance.now() - startTime).toFixed(2);

  log.info(
    __PRE_BUNDLED_FILENAME__,
    `The '${id}' plugin was successfully executed in ${timeDifference} ms`,
  );
}
