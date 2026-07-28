import { expect, test } from "vitest";

import { getRelativeDate } from "./get-relative-date.ts";

const testData = [
  [
    { "days": 8 },
    "1995-12-25T00:24:00.000Z",
  ],
  [
    { "days": 1000 },
    "1998-09-12T00:24:00.000Z",
  ],
  [
    { "hours": 21 },
    "1995-12-17T21:24:00.000Z",
  ],
  [
    { "minutes": 54 },
    "1995-12-17T01:18:00.000Z",
  ],
  [
    { "seconds": 37 },
    "1995-12-17T00:24:37.000Z",
  ],
  [
    { "milliseconds": 69 },
    "1995-12-17T00:24:00.069Z",
  ],
  [
    { "days": 10, "minutes": 20, "seconds": 30 },
    "1995-12-27T00:44:30.000Z",
  ],
] as const;

for (const [input, output] of testData) {
  const testName = `Relative Date: ${JSON.stringify(input)}`;
  // Example date was taken from MDN docs
  const equalDate = new Date("December 17, 1995 00:24:00 UTC");

  test(testName, () => {
    expect(
      getRelativeDate({
        "from": equalDate,
        ...input,
      }).toISOString(),
    ).toBe(output);
  });
}
