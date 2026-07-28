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

async function readSources(
  filePaths: ReadonlyArray<string>,
): Promise<ReadonlyArray<Readonly<{ "filePath": string; "source": string }>>> {
  return await Promise.all(filePaths.map(async filePath => ({
    filePath,
    "source": await readFile(filePath, "utf8"),
  })));
}

test("raw Tauri and community APIs stay confined to broker adapters", async () => {
  const violations: Array<string> = [];
  const sourceFiles = await listSourceFiles(sourceRoot);
  const filePaths = sourceFiles.filter(filePath => {
    const relativePath = filePath.slice(sourceRoot.length);

    return !relativePath.endsWith(".test.ts") &&
      !relativePath.endsWith("/capability-broker/desktop-adapter.ts") &&
      !relativePath.endsWith("/capability-broker/direct-desktop.ts");
  });
  const sources = await readSources(filePaths);

  for (const { filePath, source } of sources) {
    const relativePath = filePath.slice(sourceRoot.length);

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
  const sources = await readSources(files);

  for (const { filePath, source } of sources) {
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
  const sources = await readSources(files);

  for (const { source } of sources) {
    expect(source).toMatch(/"__KAEDE__"\?:/u);
    expect(source).toMatch(/"__KAEDE_INTERNALS__"\?:/u);
  }
});
