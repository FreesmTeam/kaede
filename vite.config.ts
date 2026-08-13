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
import { defineConfig, type IndexHtmlTransformResult, type Plugin } from "vite";
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

function injectSafariPolyfills(): Plugin {
  return {
    "name"              : "inject-safari-polyfills",
    "transformIndexHtml": {
      "order": "pre",
      "handler"(): IndexHtmlTransformResult {
        return [
          {
            "tag"     : "script",
            "children": `
              // Safari < 14
              // https://developer.mozilla.org/en-US/docs/Web/API/MediaQueryList#browser_compatibility
              if (window.matchMedia) {
                const mql = window.matchMedia("(min-width: 1px)");
                const proto = Object.getPrototypeOf(mql);
                
                if (proto && typeof proto.addEventListener !== 'function') {
                  proto.addEventListener = function(type, listener) {
                    this.addListener(listener);
                  };
                  proto.removeEventListener = function(type, listener) {
                    this.removeListener(listener);
                  };
                }
              }

              // Safari < 15
              // https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext#browser_compatibility
              if (window.WebGL2RenderingContext === undefined) {
                window.WebGL2RenderingContext = window.WebGLRenderingContext ?? {};
              }

              // Safari < 15.4
              // https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone#browser_compatibility
              if (window.structuredClone === undefined) {
                window.structuredClone = input => {
                  // Kaede only used 'structuredClone' to clone a 'ConfigType' object,
                  // which only contains JSON values. Well, we could use this library:
                  // https://github.com/ungap/structured-clone
                  // But I am too lazy to add it properly here
                  return JSON.parse(JSON.stringify(input));
                };
              }
            `,
            "injectTo": "head-prepend",
          },
        ];
      },
    },
  };
}

// In macOS builds, 'oldSafari' is true
const transpiledForSafari = {
  "build": kaedeExtraConfiguration.oldSafari ? {
    "target": ["safari13"],
  } : {},
  "esbuild": kaedeExtraConfiguration.oldSafari ? {
    "esbuildOptions": {
      "target": ["safari13"],
    },
  } : {},
  "plugins": kaedeExtraConfiguration.oldSafari ? [
    injectSafariPolyfills(),
  ] : [],
};

export default defineConfig({
  // Use '/kaede' base path for GitHub Pages
  "base" : kaedeExtraConfiguration.useKaedeBase ? "/kaede" : undefined,
  "build": {
    ...transpiledForSafari.build,
    // Do not inline any images
    "assetsInlineLimit": 0,
  },
  "optimizeDeps": {
    ...transpiledForSafari.esbuild,
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
    ...transpiledForSafari.plugins,
    // Handle a Vue framework
    vue(),
    // Handle a UnoCSS package
    unocss(),
    // Handle an ESLint package
    eslint(),
  ],
});
