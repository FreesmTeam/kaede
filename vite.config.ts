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
import unocss from "unocss/vite";
import { defineConfig } from "vite";
import eslint from "vite-plugin-eslint2";

import kaedeExtraConfiguration from "./kaede-extra.json";

function handleSourceFileNames(): {
  "name"     : string;
  "enforce"  : "pre";
  "transform": (source: string, id: string) => { "code": string; "map": null };
} {
  return {
    "name"     : "handle-source-file-names",
    // Ensure that the sources we get are untouched by 'esbuild' and others
    "enforce"  : "pre",
    "transform": (source: string, id: string): { "code": string; "map": null } => {
      /*
       * Replacing is not an option since 'process.cwd'
       * returns 'letter:\path\...' when 'id' is 'letter:/path/...'
       */
      const relativePath: string = id.slice(process.cwd().length);

      // Avoid having 'const "/src/declarations.ts:90": string;' in the 'declarations.ts'
      if (relativePath === "/src/declarations.ts") {
        return { "code": source, "map": null };
      }

      return {
        "code": source
          .split("\n")
          .map((line, index) => {
            const lineNumber: number = index + 1;

            return line.replaceAll(
              "__PRE_BUNDLED_FILENAME__",
              `"${relativePath}:${lineNumber}"`,
            );
          })
          .join("\n"),
        "map": null,
      };
    },
  };
}

// In macOS builds, 'oldSafari' is true
const transpiledForSafari = kaedeExtraConfiguration.oldSafari ? {
  "target": ["safari13"],
} : {};

export default defineConfig({
  // Use '/kaede' base path for GitHub Pages
  "base" : kaedeExtraConfiguration.useKaedeBase ? "/kaede" : undefined,
  "build": {
    // Do not inline any images
    "assetsInlineLimit": 0,
    ...transpiledForSafari,
  },
  // Better support for Tauri CLI output
  "clearScreen": false,
  // Enable environment variables
  "envPrefix"  : ["VITE_", "TAURI_"],
  "server"     : {
    // Tauri requires a consistent port
    "strictPort": true,
  },

  /*
   * Experiments with bundle size
   * "build": {
   *   "rollupOptions": {
   *     "external": ["typebox/compile", "typebox"],
   *   },
   * },
   */

  // Handle '@/...' imports
  "resolve": {
    "alias": {
      "@": path.resolve(__dirname, "./src"),
    },
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
});
