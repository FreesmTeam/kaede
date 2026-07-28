import {
  copyFile,
  mkdir,
  mkdtemp,
  rm,
  symlink,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contexts = ["sandbox", "trusted"] as const;
const generatedFiles = {
  "sandbox": ["ark-of-atrahasis-1.0.d.ts", "kaede-sandbox.d.ts"],
  "trusted": [
    "ark-of-atrahasis-1.0.d.ts",
    "kaede-lib.d.ts",
    "kaede-trusted.d.ts",
  ],
} as const;
const fixtureFiles = {
  "sandbox": ["playground-default.ts", "plugin.ts", "tsconfig.json"],
  "trusted": ["plugin.ts", "tsconfig.json"],
} as const;
const trustedTypePackages = ["@vue", "csstype", "typebox", "vue"] as const;
const resolutions = [
  { "module": "preserve", "moduleResolution": "bundler" },
  { "module": "node16", "moduleResolution": "node16" },
  { "module": "nodenext", "moduleResolution": "nodenext" },
] as const;
const typescriptCompiler = path.resolve(
  repositoryRoot,
  "node_modules/typescript/bin/tsc",
);

for (const context of contexts) {
  const isolatedRoot = await mkdtemp(path.join(os.tmpdir(), `kaede-${context}-types-`));
  const isolatedTypes = path.resolve(isolatedRoot, "types");
  const isolatedFixture = path.resolve(isolatedTypes, "fixtures", context);

  try {
    await mkdir(isolatedFixture, { "recursive": true });

    const generatedContextFiles = generatedFiles[context];

    for (const fileName of generatedContextFiles) {
      await copyFile(
        path.resolve(repositoryRoot, "types", fileName),
        path.resolve(isolatedTypes, fileName),
      );
    }

    await copyFile(
      path.resolve(repositoryRoot, "types/package.json"),
      path.resolve(isolatedTypes, "package.json"),
    );

    const fixtureContextFiles = fixtureFiles[context];

    for (const fileName of fixtureContextFiles) {
      await copyFile(
        path.resolve(repositoryRoot, "types", "fixtures", context, fileName),
        path.resolve(isolatedFixture, fileName),
      );
    }

    if (context === "trusted") {
      const isolatedModules = path.resolve(isolatedRoot, "node_modules");

      await mkdir(isolatedModules);

      for (const packageName of trustedTypePackages) {
        const isolatedPackage = path.resolve(isolatedModules, packageName);

        await mkdir(path.dirname(isolatedPackage), { "recursive": true });
        await symlink(
          path.resolve(repositoryRoot, "node_modules", packageName),
          isolatedPackage,
          process.platform === "win32" ? "junction" : "dir",
        );
      }
    }

    const project = path.resolve(isolatedFixture, "tsconfig.json");

    for (const resolution of resolutions) {
      const compiler = Bun.spawn([
        process.execPath,
        typescriptCompiler,
        "--project",
        project,
        "--module",
        resolution.module,
        "--moduleResolution",
        resolution.moduleResolution,
        "--pretty",
        "false",
      ], {
        "cwd"   : isolatedRoot,
        "stdout": "inherit",
        "stderr": "inherit",
      });
      const exitCode = await compiler.exited;

      if (exitCode !== 0) {
        throw new Error(
          `Type consumer '${context}' failed under ${resolution.moduleResolution}`,
        );
      }

      await Bun.write(
        Bun.stdout,
        `Checked isolated ${context} consumer under ${resolution.moduleResolution}\n`,
      );
    }
  } finally {
    await rm(isolatedRoot, { "force": true, "recursive": true });
  }
}
