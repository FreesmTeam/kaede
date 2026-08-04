import "ses";

import { log } from "@/lib/logging/log.ts";

let locked: boolean = false;

export function lockdownEnvironment(): void {
  if (locked) {
    return;
  }

  log.debug(__PRE_BUNDLED_FILENAME__, "Locking down the JavaScript environment");

  /*
   * Can throw an error, which is a desirable behavior
   * since we do NOT want to execute sandboxed plugins without environment lockdown
   */
  lockdown({

    /*
     * 'safeEval' adds some restrictions to 'eval' and the 'Function' constructor, e.g.:
     * - anything that looks like HTML comments is rejected.
     *
     * 'noEval' completely disables 'eval' and the 'Function' constructor.
     *
     * 'unsafeEval' appears not to change the behavior of 'eval' and the 'Function' constructor.
     */
    "evalTaming": "unsafeEval",
  });

  locked = true;

  return log.info(__PRE_BUNDLED_FILENAME__, "The JavaScript environment was locked down");
}
