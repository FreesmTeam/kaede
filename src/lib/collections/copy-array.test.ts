import { expect, test } from "vitest";

import {
  copyAndReverse,
  copyAndSort,
} from "@/lib/collections/copy-array.ts";

test("copies arrays without ES2023 change-by-copy methods", () => {
  const toSorted = Object.getOwnPropertyDescriptor(Array.prototype, "toSorted");
  const toReversed = Object.getOwnPropertyDescriptor(Array.prototype, "toReversed");

  Reflect.deleteProperty(Array.prototype, "toSorted");
  Reflect.deleteProperty(Array.prototype, "toReversed");

  try {
    const input = ["second", "first"];

    expect(copyAndSort(input)).toEqual(["first", "second"]);
    expect(copyAndReverse(input)).toEqual(["first", "second"]);
    expect(input).toEqual(["second", "first"]);
  } finally {
    if (toSorted !== undefined) {
      Object.defineProperty(Array.prototype, "toSorted", toSorted);
    }

    if (toReversed !== undefined) {
      Object.defineProperty(Array.prototype, "toReversed", toReversed);
    }
  }
});
