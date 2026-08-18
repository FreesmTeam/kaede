import Errors from "@/lib/errors";
import { log } from "@/lib/logging/log.ts";
import { modalStates, type PendingModalType } from "@/states/modal.ts";

export function confirm({
  title,
  description,
  icon,
  rows,
}: {
  "title"      : string;
  "description": string;
  "icon"      ?: string;
  "rows"      ?: Array<{
    "title"      : string;
    "description": string;
    "icon"      ?: string;
  }>;
}): Promise<boolean> {
  const actions: PendingModalType["actions"] = [];
  const entry: PendingModalType = {
    title,
    description,
    icon,
    rows,
    actions,
  };

  return new Promise((resolve: (input: boolean) => void) => {
    const handler = (state: boolean): void => {
      // 'entry' is a constant reference
      modalStates.delete(entry);
      resolve(state);
    };

    actions.push(
      { "label": "Cancel", "callback": (): void => handler(false) },
      { "label": "Confirm", "callback": (): void => handler(true) },
    );
    // Now, we can actually update the UI
    modalStates.add(entry);
  }).catch(error => {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "An error occurred for the modal:",
      Errors.prettify(error),
    );

    // Treat any unknown errors as a rejection for the user confirmation
    return false;
  });
}
