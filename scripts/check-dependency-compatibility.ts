import { readdir, readFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

interface PackageJson {
  "exports"?: {
    "."?: {
      "import"?: string | { "default"?: string };
    };
  };
  "module"? : string;
  "name"?   : string;
  "version"?: string;
}

const candidate = "data-x";
const pattern = "{data,aria}-*";
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRequire = createRequire(import.meta.url);
const minimatchPackages: Array<{ "directory": string; "manifest": PackageJson }> = [];
const visitedNodeModules = (new Set<string>);

const readManifest = async (directory: string): Promise<PackageJson | undefined> => {
  try {
    return JSON.parse(
      await readFile(path.join(directory, "package.json"), "utf8"),
    ) as PackageJson;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
};

const inspectPackage = async (directory: string): Promise<void> => {
  const manifest = await readManifest(directory);

  if (!manifest) return;

  if (manifest.name === "minimatch") minimatchPackages.push({ directory, manifest });
  await collectFromNodeModules(path.join(directory, "node_modules"));
};

const collectFromNodeModules = async (directory: string): Promise<void> => {
  let canonicalDirectory: string;

  try {
    canonicalDirectory = await realpath(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }

  if (visitedNodeModules.has(canonicalDirectory)) return;
  visitedNodeModules.add(canonicalDirectory);

  const entries = await readdir(directory, { "withFileTypes": true });

  await Promise.all(entries.filter(entry => entry.name !== ".bin").map(async entry => {
    const entryPath = path.join(directory, entry.name);

    if (entry.name.startsWith("@")) {
      const scopedEntries = await readdir(entryPath, { "withFileTypes": true });

      await Promise.all(scopedEntries.map(async scopedEntry => {
        await inspectPackage(path.join(entryPath, scopedEntry.name));
      }));

      return;
    }

    await inspectPackage(entryPath);
  }));
};

const expectMatch = (
  label: string,
  isMatch: (candidate: string, pattern: string) => boolean,
): void => {
  const isMatching = isMatch(candidate, pattern);

  if (!isMatching) {
    const expectation = `${JSON.stringify(candidate)} to match ${JSON.stringify(pattern)}`;

    throw new Error(`${label}: expected ${expectation}, got ${isMatching}`);
  }
};

await collectFromNodeModules(path.join(projectRoot, "node_modules"));

if (minimatchPackages.length === 0) {
  throw new Error("No installed minimatch packages found");
}

const installedMajors = (new Set<number>);

await Promise.all(minimatchPackages.map(async ({ directory, manifest }) => {
  if (!manifest.version) throw new Error(`Missing minimatch version in ${directory}`);

  const major = Number(manifest.version.split(".", 1)[0]);

  installedMajors.add(major);
  const label = `minimatch@${manifest.version} (${path.relative(projectRoot, directory)})`;
  const required = projectRequire(directory) as
    | ((candidate: string, pattern: string) => boolean)
    | { "minimatch"?: (candidate: string, pattern: string) => boolean };
  const commonJsMatcher = typeof required === "function" ? required : required.minimatch;

  if (!commonJsMatcher) throw new Error(`${label}: CommonJS minimatch export is missing`);
  expectMatch(`${label} CommonJS`, commonJsMatcher);

  const importExport = manifest.exports?.["."]?.import;
  const importTarget =
    typeof importExport === "string" ? importExport : importExport?.default ?? manifest.module;

  if (importTarget) {
    const imported = (await import(pathToFileURL(path.join(directory, importTarget)).href)) as {
      "minimatch"?: (candidate: string, pattern: string) => boolean;
    };

    if (!imported.minimatch) throw new Error(`${label}: ESM minimatch export is missing`);
    expectMatch(`${label} ESM`, imported.minimatch);
  }
}));

process.stdout.write(
  `Verified ${minimatchPackages.length} minimatch installs across majors ${[...installedMajors]
    .toSorted((a, b) => a - b)
    .join(", ")}\n`,
);
