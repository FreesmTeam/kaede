import { describe, expect, test } from "vitest";

import {
  hashMd5Locally,
  hashSha256Locally,
  hashStringSha256Locally,
} from "@/lib/cryptography/local-hashes.ts";

describe("local hashes", () => {
  test("matches the standard empty-input vectors", () => {
    expect(hashMd5Locally(new Uint8Array)).toBe(
      "d41d8cd98f00b204e9800998ecf8427e",
    );
    expect(hashSha256Locally(new Uint8Array)).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  test("encodes strings as exact UTF-8 bytes", () => {
    expect(hashStringSha256Locally("Kaede 🌸")).toBe(
      hashSha256Locally((new TextEncoder).encode("Kaede 🌸")),
    );
  });
});
