import { expect, test } from "bun:test";

import type { NativeErrorType } from "@/types/errors/error-handling.type.ts";

import { extract } from "./extract";

const defaultError = {
  "name"   : "Unknown Error",
  "message": "unknown",
  "stack"  : "Unknown Error: unknown",
};
const testData: Array<[unknown, NativeErrorType]> = [
  [
    { "days": 8 },
    defaultError,
  ],
  [
    "Some errors can be a string",
    { ...defaultError, "stack": "Some errors can be a string" },
  ],
  [
    1,
    defaultError,
  ],
  [
    undefined,
    defaultError,
  ],
  [
    { "name": 3, "message": "lol" },
    { "name": defaultError.name, "message": "lol", "stack": defaultError.stack },
  ],
  [
    { "name": "moondrop space travel", "message": 0 },
    {
      "name"   : "moondrop space travel",
      "message": defaultError.message,
      "stack"  : defaultError.stack,
    },
  ],
  [
    { "name": { "name": "tf is this" }, "message": "" },
    { "name": defaultError.name, "message": "", "stack": defaultError.stack },
  ],
  [
    {
      "name"   : "DECO*27",
      "message": "Cherry Pop",
      "stack"  : "bruh i am listening to a different song",
      "trace"  : "whar",
    },
    {
      "name"   : "DECO*27",
      "message": "Cherry Pop",
      "stack"  : "bruh i am listening to a different song",
    },
  ],
];

for (const [input, output] of testData) {
  const testName = `Extract Error: ${JSON.stringify(input)}`;

  test(testName, () => {
    expect(
      JSON.stringify(extract(input)),
    ).toBe(
      JSON.stringify(output),
    );
  });
}
