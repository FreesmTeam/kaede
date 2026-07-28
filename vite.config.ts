/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import path from "node:path";

import vue from "@vitejs/plugin-vue";
import MagicString from "magic-string";
import unocss from "unocss/vite";
import type { Plugin } from "vite";
import eslint from "vite-plugin-eslint2";
import { defineConfig } from "vitest/config";

import kaedeExtraConfiguration from "./kaede-extra.json";

type SourceFileTransformResult = null | Readonly<{
  "code": string;
  "map" : ReturnType<MagicString["generateMap"]>;
}>;

const frameworkVendorFragments: readonly string[] = [
  "/node_modules/@tanstack/vue-query/",
  "/node_modules/@vue/",
  "/node_modules/@vueuse/",
  "/node_modules/pinia/",
  "/node_modules/vue/",
  "/node_modules/vue-router/",
];

const sandboxVendorFragments: readonly string[] = [
  "/node_modules/@endo/",
  "/node_modules/ark-of-atrahasis/",
  "/node_modules/ses/",
  "/node_modules/typebox/",
];

function hasVendorFragment(moduleId: string, fragments: readonly string[]): boolean {
  const normalizedModuleId: string = moduleId.replaceAll("\\", "/");

  return fragments.some(fragment => normalizedModuleId.includes(fragment));
}

function isFrameworkVendor(moduleId: string): boolean {
  return hasVendorFragment(moduleId, frameworkVendorFragments);
}

function isSandboxVendor(moduleId: string): boolean {
  return hasVendorFragment(moduleId, sandboxVendorFragments);
}

function handleSourceFileNames(): Plugin {
  return {
    "name"     : "handle-source-file-names",
    // Ensure that the sources we get are untouched by 'esbuild' and others
    "enforce"  : "pre",
    "transform": (source: string, id: string): SourceFileTransformResult => {
      /*
       * Replacing is not an option since 'process.cwd'
       * returns 'letter:\path\...' when 'id' is 'letter:/path/...'
       */
      const relativePath: string = id.slice(process.cwd().length);

      // Avoid having 'const "/src/declarations.ts:90": string;' in the 'declarations.ts'
      if (
        relativePath === "/src/declarations.ts"
        || !source.includes("__PRE_BUNDLED_FILENAME__")
      ) {
        return null;
      }

      const placeholder = "__PRE_BUNDLED_FILENAME__";
      const transformedSource = new MagicString(source);
      let lineNumber = 1;
      let scannedIndex = 0;
      let placeholderIndex = source.indexOf(placeholder);

      while (placeholderIndex !== -1) {
        while (scannedIndex < placeholderIndex) {
          if (source.codePointAt(scannedIndex) === 0x0A) {
            lineNumber += 1;
          }

          scannedIndex += 1;
        }

        transformedSource.overwrite(
          placeholderIndex,
          placeholderIndex + placeholder.length,
          JSON.stringify(`${relativePath}:${lineNumber}`),
        );
        scannedIndex = placeholderIndex + placeholder.length;
        placeholderIndex = source.indexOf(placeholder, scannedIndex);
      }

      return {
        "code": transformedSource.toString(),
        "map" : transformedSource.generateMap({
          "hires"         : true,
          "includeContent": true,
          "source"        : id,
        }),
      };
    },
  };
}

export default defineConfig(({ mode }) => {
  const useBrowserAdapter = kaedeExtraConfiguration.useKaedeBase || mode === "test";
  const browserAdapterRoot = path.resolve(
    import.meta.dirname,
    useBrowserAdapter ? "./src/lib/__browser" : "./src/lib/browser",
  );

  return {
    // Use '/kaede' base path for GitHub Pages
    "base"       : kaedeExtraConfiguration.useKaedeBase ? "/kaede" : undefined,
    // Better support for Tauri CLI output
    "clearScreen": false,
    // Enable environment variables
    "envPrefix"  : ["VITE_", "TAURI_"],
    "server"     : {
      // Tauri requires a consistent port
      "strictPort": true,
    },
    "build": {

      /*
       * Modern builds stay on ESNext. The Win7 gate targets its final WebView2,
       * which is based on Chromium 109.
       */
      "target"         : process.env.VITE_BUILD_TARGET ?? "esnext",
      "rolldownOptions": {
        "output": {

          /*
           * Keep third-party code out of the application entry chunk while
           * preserving source evaluation order for side-effectful packages.
           */
          "strictExecutionOrder": true,
          "codeSplitting"       : {
            "groups": [
              {
                "name"    : "vendor-framework",
                "test"    : isFrameworkVendor,
                "priority": 40,
              },
              {
                "name"    : "vendor-editor",
                "test"    : /node_modules[\\/]prism-code-editor[\\/]/,
                "priority": 30,
              },
              {
                "name"    : "vendor-sandbox",
                "test"    : isSandboxVendor,
                "priority": 20,
              },
              {
                "name"    : "vendor",
                "test"    : /node_modules[\\/]/,
                "priority": 10,
              },
            ],
          },
        },
      },
    },
    // Handle '@/...' imports
    "resolve": {
      "alias": {
        // Select a whole adapter root without mutating the source tree.
        "@/lib/browser": browserAdapterRoot,
        "@"            : path.resolve(import.meta.dirname, "./src"),

        /*
         * Remove this source alias after Ark 1.0 is published to npm.
         * The exact pre-release Git commit is pinned in package.json, but Git
         * dependencies do not run Ark's prepack build under Bun.
         */
        "ark-of-atrahasis": path.resolve(
          import.meta.dirname,
          "./node_modules/ark-of-atrahasis/src/index.ts",
        ),
      },
    },
    "test": {
      "setupFiles": ["./vitest.setup.ts"],
    },
    "plugins": [
      // Replace all '__PRE_BUNDLED_FILENAME__,' variables at build time
      handleSourceFileNames(),
      // Handle a Vue framework
      vue(),
      // Handle a UnoCSS package
      unocss(),
      // Handle an ESLint package
      eslint(),
    ],
  };
});
