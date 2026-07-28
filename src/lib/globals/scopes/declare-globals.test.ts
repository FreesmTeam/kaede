import { afterEach, expect, test, vi } from "vitest";

vi.mock("@/lib/globals", () => ({ "default": {} }));

import {
  declareGlobals,
  revokeExtensionGlobals,
} from "@/lib/globals/scopes/declare-globals.ts";
import Txiki from "@/lib/txiki";

afterEach(() => {
  declareGlobals();
});

test("keeps Txiki on captured trusted Kaede after bootstrap aliases are revoked", () => {
  declareGlobals();

  const trustedKaede = window.__KAEDE__;

  expect(trustedKaede?.libs.Txiki).toBe(Txiki);
  revokeExtensionGlobals();
  expect(window).not.toHaveProperty("__KAEDE__");
  expect(window).not.toHaveProperty("__KAEDE_INTERNALS__");
  expect(trustedKaede?.libs.Txiki).toBe(Txiki);
});
