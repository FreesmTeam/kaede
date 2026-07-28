import path from "node:path";
import { fileURLToPath } from "node:url";

type KaedeExtraConfig = {
  "useKaedeBase": boolean;
};

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(repositoryRoot, "kaede-extra.json");
const config = await Bun.file(configPath).json() as KaedeExtraConfig;

config.useKaedeBase = true;
await Bun.write(configPath, `${JSON.stringify(config, null, 2)}\n`);
