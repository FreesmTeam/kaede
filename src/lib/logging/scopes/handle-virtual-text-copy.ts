import Errors from "@/lib/errors";
import { log } from "@/lib/logging/scopes/log.ts";

export async function handleVirtualTextCopy(
  isCopied: boolean,
  range: [number, number] | undefined,
  logs: Array<string | [number, string]>,
  setCopied: (isCopied: boolean) => void,
): Promise<void> {
  if (isCopied || !range || !logs[0]) {
    return;
  }

  try {
    const rangeStartIndex = Math.min(range[0], range[1]);
    const rangeEndIndex = Math.max(range[0], range[1]);

    let slicedSelectionText: string;

    if (typeof logs[0] === "string") {
      slicedSelectionText = logs.slice(rangeStartIndex, rangeEndIndex + 1).join("\n");
    } else {
      let relativeIndexStart: number = 0;
      let relativeIndexEnd: number = 0;

      for (const [index, currentLog] of logs.entries()) {
        const currentLogIndex = currentLog[0] as number;

        if (currentLogIndex === rangeStartIndex) {
          relativeIndexStart = index;
        }

        if (currentLogIndex === rangeEndIndex) {
          relativeIndexEnd = index;

          break;
        }
      }

      slicedSelectionText = logs
        .map(mappingEntry => mappingEntry[1])
        .slice(
          relativeIndexStart,
          relativeIndexEnd + 1,
        )
        .join("\n");
    }

    await navigator.clipboard.writeText(slicedSelectionText);

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 500);
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Couldn't copy the selected text in virtualized log viewer:",
      Errors.prettify(error),
    );
  }
}
