import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "vitest";

const workspaceRoot = process.cwd();
const sourceRoot = path.resolve(workspaceRoot, "src");

async function listSourceFiles(directory: string): Promise<Array<string>> {
  const entries = await readdir(directory, { "withFileTypes": true });
  const files = await Promise.all(
    entries.map(async entry => {
      const entryPath = path.resolve(directory, entry.name);

      if (entry.isDirectory()) {
        return listSourceFiles(entryPath);
      }

      return (/\.(?:js|ts|tsx|vue)$/u).test(entry.name) ? [entryPath] : [];
    }),
  );

  return files.flat();
}

test("raw Tauri and community APIs stay confined to broker adapters", async () => {
  const violations: Array<string> = [];

  for (const filePath of await listSourceFiles(sourceRoot)) {
    const relativePath = filePath.slice(sourceRoot.length);

    if (
      relativePath.endsWith(".test.ts") ||
      relativePath.endsWith("/capability-broker/desktop-adapter.ts") ||
      relativePath.endsWith("/capability-broker/direct-desktop.ts")
    ) {
      continue;
    }

    const source = await readFile(filePath, "utf8");

    if (
      source.includes("@tauri-apps/") ||
      source.includes("tauri-plugin-shellx-api") ||
      source.includes("__TAURI") ||
      (/\binvoke\s*\(/u).test(source)
    ) {
      violations.push(relativePath);
    }
  }

  expect(violations).toEqual([]);
});

test("legacy broad global permission requests stay removed", async () => {
  const files = [
    path.resolve(sourceRoot, "declarations.ts"),
    path.resolve(sourceRoot, "extendable/global-internals.ts"),
    path.resolve(workspaceRoot, "vitest.setup.ts"),
    path.resolve(workspaceRoot, "types/kaede-lib.d.ts"),
  ];
  const violations: Array<string> = [];

  for (const filePath of files) {
    const source = await readFile(filePath, "utf8");

    if ((/requestPermissions[\s\S]{0,180}Promise<Array<boolean>>/u).test(source)) {
      violations.push(path.relative(workspaceRoot, filePath));
    }
  }

  expect(violations).toEqual([]);
});

test("revoked extension window globals stay optional", async () => {
  const files = [
    path.resolve(sourceRoot, "declarations.ts"),
    path.resolve(workspaceRoot, "types/kaede-lib.d.ts"),
  ];

  for (const filePath of files) {
    const source = await readFile(filePath, "utf8");

    expect(source).toMatch(/"__KAEDE__"\?:/u);
    expect(source).toMatch(/"__KAEDE_INTERNALS__"\?:/u);
  }
});
