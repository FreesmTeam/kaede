import path from "node:path";
import { fileURLToPath } from "node:url";

type TauriBuildConfig = {
  "productName": string;
  "version"    : string;
  "app"        : {
    "windows": Array<{ "title": string }>;
  };
};

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(repositoryRoot, "src-tauri/tauri.conf.json");
const cargoPath = path.join(repositoryRoot, "src-tauri/Cargo.toml");
const appVersion = process.env.APP_VERSION;

if (appVersion === undefined || appVersion === "") {
  throw new Error("Missing APP_VERSION");
}

const outputPath = process.env.GITHUB_OUTPUT;

if (outputPath === undefined || outputPath === "") {
  throw new Error("Missing GITHUB_OUTPUT");
}

const referenceName = process.env.GITHUB_REF_NAME;

if (referenceName === undefined || referenceName === "") {
  throw new Error("Missing GITHUB_REF_NAME");
}

const artifactReference = referenceName.replaceAll(/["/:<>|*?\\\r\n]+/gu, "-");

if (artifactReference === "") {
  throw new Error("GITHUB_REF_NAME does not contain an artifact-safe character");
}

const config = await Bun.file(configPath).json() as TauriBuildConfig;
const primaryWindow = config.app.windows[0];

if (primaryWindow === undefined) {
  throw new Error("Tauri configuration does not contain a primary window");
}
if (process.env.BUILD_TYPE === "portable") {
  primaryWindow.title = "Kaede Portable";
}
config.version = appVersion;
await Bun.write(configPath, `${JSON.stringify(config, null, 2)}\n`);

const cargo = await Bun.file(cargoPath).text();
const packageVersion = /^version = "[^"]+"$/m;

if (!packageVersion.test(cargo)) {
  throw new Error("Cargo package version field was not found");
}
await Bun.write(cargoPath, cargo.replace(packageVersion, () => `version = "${appVersion}"`));
const buildOutputs = [
  `productName=${config.productName}`,
  `version=${config.version}`,
  `artifactRef=${artifactReference}`,
  "",
].join("\n");

await Bun.write(outputPath, buildOutputs);
