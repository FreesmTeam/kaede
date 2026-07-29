import Errors from "@/lib/errors";
import { log } from "@/lib/logging/log.ts";
import type { FieldTextType } from "@/types/logging/log-field-text.type.ts";

export function getLogFieldText(input: string, toSearch: string): string | FieldTextType {
  const lowerCasedInput = input.toLowerCase();

  if (toSearch === "" || !lowerCasedInput.includes(toSearch)) {
    return input;
  }

  let occurrences: Array<RegExpExecArray>;

  try {
    occurrences = [
      ...lowerCasedInput.matchAll(new RegExp(toSearch, "g")),
    ];
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Couldn't match all search keyword occurrences in the logs:",
      Errors.prettify(error),
    );

    return input;
  }

  const noOccurrenceFields = [];
  const occurrenceExtractions = [];
  let previousIndex = 0;

  for (const occurrence of occurrences) {
    const occurrenceIndex = occurrence.index;

    noOccurrenceFields.push(input.slice(
      previousIndex,
      occurrenceIndex,
    ));
    occurrenceExtractions.push(input.slice(
      occurrenceIndex,
      occurrenceIndex + toSearch.length,
    ));

    previousIndex = occurrenceIndex + toSearch.length;
  }

  noOccurrenceFields.push(input.slice(previousIndex));

  return {
    "extractions": occurrenceExtractions,
    "fields"     : noOccurrenceFields,
  };
}
