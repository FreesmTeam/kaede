import { AsyncFunction } from "@/constants/application.ts";
import Errors from "@/lib/errors";
import { log } from "@/lib/logging/scopes/log.ts";

export async function runInUnrestricted(id: string, code: string): Promise<void> {
  const startTime = performance.now();

  log.debug(__PRE_BUNDLED_FILENAME__, `Initializing the '${id}' extension code`);

  const compiled = new AsyncFunction("scopedThis", code);

  log.debug(
    __PRE_BUNDLED_FILENAME__,
    `Executing the '${id}' extension code in the unrestricted environment`,
  );
  try {
    await compiled({
      "huuh": false,
      "fn"  : () => {
        console.log("Hi from " + id);
      },
    });
  } catch (error: unknown) {
    return log.error(
      __PRE_BUNDLED_FILENAME__,
      `Failed to execute the '${id}' extension code in the unrestricted environment:`,
      Errors.prettify(error),
    );
  }

  const endTime = performance.now();
  const timeDifference = (endTime - startTime).toFixed(2);

  log.info(
    __PRE_BUNDLED_FILENAME__,
    `The '${id}' plugin was successfully executed in ${timeDifference} ms`,
  );
}
