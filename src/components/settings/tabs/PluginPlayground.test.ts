import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "vitest";

import {
  codeToEvaluate,
  createPlaygroundDraft,
} from "@/states/plugin-playground.ts";

const playgroundPath = path.resolve(
  process.cwd(),
  "src/components/settings/tabs/PluginPlayground.vue",
);
const playgroundStatePath = path.resolve(
  process.cwd(),
  "src/states/plugin-playground.ts",
);
const sourceRoot = path.resolve(process.cwd(), "src");

async function listProductionSourceFiles(directory: string): Promise<Array<string>> {
  const entries = await readdir(directory, { "withFileTypes": true });
  const files = await Promise.all(entries.map(async entry => {
    const entryPath = path.resolve(directory, entry.name);

    if (entry.isDirectory()) {
      return listProductionSourceFiles(entryPath);
    }

    if (
      !(/\.(?:js|ts|tsx|vue)$/u).test(entry.name) ||
      entry.name.endsWith(".test.ts")
    ) {
      return [];
    }

    return [entryPath];
  }));

  return files.flat();
}

function expectNoDynamicCodeSink(source: string): void {
  expect(source).not.toMatch(/\bAsyncFunction\b/u);
  expect(source).not.toMatch(/\bFunction\s*\(/u);
  expect(source).not.toMatch(/\beval\s*\(/u);
  expect(source).not.toMatch(/\bCompartment\b/u);
  expect(source).not.toMatch(/\brunIn(?:Sandbox|Unrestricted)\b/u);
}

function linesUsing(source: string, name: string): Array<string> {
  return source
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.includes(name));
}

test("playground draft state has only editor and state-module consumers", async () => {
  const consumers: Array<string> = [];

  for (const filePath of await listProductionSourceFiles(sourceRoot)) {
    const source = await readFile(filePath, "utf8");

    if (source.includes("codeToEvaluate")) {
      consumers.push(path.relative(process.cwd(), filePath));
      expectNoDynamicCodeSink(source);
    }
  }

  expect(consumers.sort()).toEqual([
    "src/components/settings/tabs/PluginPlayground.vue",
    "src/states/plugin-playground.ts",
  ]);
});

test("playground source cannot execute code with trusted Host helpers", async () => {
  const [source, stateSource] = await Promise.all([
    readFile(playgroundPath, "utf8"),
    readFile(playgroundStatePath, "utf8"),
  ]);

  expect(source).not.toMatch(/@click=["']handleCode["']/u);
  expect(source).not.toMatch(/import\s+ExtensionsManager\s+from/u);
  expect(source).not.toMatch(/import\s+FileStructure\s+from/u);
  expect(linesUsing(source, "codeToEvaluate")).toEqual([
    "import { codeToEvaluate } from \"@/states/plugin-playground.ts\";",
    "\"value\"   : codeToEvaluate.value,",
    "codeToEvaluate.value = input;",
  ]);
  expect(linesUsing(stateSource, "codeToEvaluate")).toEqual([
    "export const codeToEvaluate = ref<string>(defaultPluginDraft);",
  ]);
});

test("default draft is the isolated typechecked Ark sandbox fixture", () => {
  const expectedDraft = `const safeDocument = scopedThis["ui/basic"];

if (safeDocument) {
  const message = safeDocument.createParagraph();

  message.setText("Hello from a sandboxed plugin");
  safeDocument.appendChild(message);
}
`;
  const crlfDraft = expectedDraft.split("\n").join("\r\n");
  const crlfFixture = [
    "/// <reference path=\"../../kaede-sandbox.d.ts\" />",
    "",
    crlfDraft,
  ].join("\r\n");

  expect(codeToEvaluate.value).toBe(expectedDraft);
  expect(createPlaygroundDraft(crlfFixture)).toBe(expectedDraft);
});

test("server rows and stop controls use opaque handle identity", async () => {
  const source = await readFile(playgroundPath, "utf8");

  expect(source).toContain(":key=\"server.value.handle\"");
  expect(source).not.toContain(":key=\"server.name\"");
  expect(source.match(/server\.value\.handle/gu)).toHaveLength(7);
  expect(source).toContain("@click=\"() => stopServer(server.value.handle)\"");
});
