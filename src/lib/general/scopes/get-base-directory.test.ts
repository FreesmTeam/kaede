import { beforeEach, describe, expect, test } from "vitest";

import { GlobalInternals } from "@/extendable/global-internals.ts";
import { getBaseDirectory } from "@/lib/general/scopes/get-base-directory.ts";

describe("getBaseDirectory", () => {
  beforeEach(() => {
    GlobalInternals.baseDirectory = "";
  });

  test("returns the base directory cached during broker bootstrap", () => {
    GlobalInternals.baseDirectory = "/runtime/app-data";

    expect(getBaseDirectory()).toBe("/runtime/app-data");
  });
});
