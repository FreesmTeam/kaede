// 'modalStates = shallowReactive(new Set);'

let modalSetOrder = 0;

function getOrder(): number {
  return modalSetOrder++;
}

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
    "order": getOrder(),
  };

  return new Promise((resolve, reject) => {
    const handler = (state: boolean): void => {
      // 'entry' is a constant reference
      modalStates.remove(entry);
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
      "An error occured for the modal:",
      Errors.prettify(error),
    );

    // Treat any unknown errors as a rejection for the user confirmation
    return false;
  });
}