// 'modalStates = shallowReactive([]);'

export async function confirm({
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
  return new Promise((resolve, reject) => {
    const agree = (): void => resolve(true);

    modalStates.push({
      title,
      description,
      icon,
      rows,
      "actions": [
        { "label": "Cancel", "callback": reject },
        { "label": "Confirm", "callback": agree },
      ],
    });
  }).catch(error => {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "An error occured for the modal:",
      Errors.prettify(error),
    );

    return false;
  });
}