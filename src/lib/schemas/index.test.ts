import { expect, test } from "vitest";

import Schemas from "@/lib/schemas/index.ts";

test("keeps generated checks synchronous and loads detailed errors asynchronously", async () => {
  expect(Schemas.ConfigValidator.Check({})).toBe(false);

  const pendingErrors = Schemas.ConfigValidator.Errors({});

  expect(pendingErrors).toBeInstanceOf(Promise);

  const errors = await pendingErrors;

  expect(errors.length).toBeGreaterThan(0);
});
