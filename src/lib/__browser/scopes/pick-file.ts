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

/**
 * ATTENTION: AI-generated (by Claude Fable 5 on 'max' reasoning)
 */

import { GlobalInternals } from "@/extendable/global-internals.ts";
import { writeToStoragePath } from "@/lib/browser/scopes/write-to-storage-path.ts";

/*
 * A replica of 'plugin:dialog|open'. Files picked with the native
 * '<input type="file">' element are copied into the browser storage
 * (under 'imports/'), so commands like 'peek_mrpack' can read them
 * later by the returned path, even after a page reload
 */

type OpenDialogOptionsType = {
  "multiple"? : boolean;
  "directory"?: boolean;
  "title"?    : string;
  "filters"?  : Array<{
    "name"      : string;
    "extensions": Array<string>;
  }>;
};

/*
 * 'convertFileSrc' is synchronous, so image previews cannot be read
 * from the asynchronous browser storage. Instead, a data URL is made
 * for every picked image and is kept here for 'convertFileSrc' calls.
 * Data URLs stay valid when saved into configs, unlike object URLs
 */
const previewUrls: Map<string, string> = new Map;

export function getFilePreviewUrl(path: string): string | undefined {
  return previewUrls.get(path);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader: FileReader = new FileReader;

    reader.addEventListener("load", (): void => {
      if (typeof reader.result !== "string") {
        return reject("Could not read the picked file as a data URL");
      }

      resolve(reader.result);
    }, { "once": true });
    reader.addEventListener("error", (): void => {
      reject("Could not read the picked file");
    }, { "once": true });

    reader.readAsDataURL(file);
  });
}

async function importPickedFile(file: File): Promise<string> {
  const base: string = GlobalInternals.baseDirectory || "indexed_db";
  const path: string = `${base}/imports/${file.name}`;

  await writeToStoragePath(path, file);

  if (file.type.startsWith("image/")) {
    previewUrls.set(path, await readAsDataUrl(file));
  }

  return path;
}

export function pickFile(
  options?: OpenDialogOptionsType,
): Promise<string | Array<string> | null> {
  const input: HTMLInputElement = document.createElement("input");

  input.type = "file";

  const extensions: Array<string> = options?.filters?.flatMap(
    filter => filter.extensions,
  ) ?? [];

  if (extensions.length > 0) {
    input.accept = extensions
      .map(extension => `.${extension}`)
      .join(",");
  }

  if (options?.multiple) {
    input.multiple = true;
  }

  const picked = new Promise<string | Array<string> | null>(resolve => {
    input.addEventListener("cancel", (): void => {
      resolve(null);
    }, { "once": true });
    input.addEventListener("change", async (): Promise<void> => {
      const files: Array<File> = [...(input.files ?? [])];

      if (files.length === 0) {
        return resolve(null);
      }

      const paths: Array<string> = [];

      for (const file of files) {
        paths.push(await importPickedFile(file));
      }

      if (options?.multiple) {
        return resolve(paths);
      }

      resolve(paths[0] ?? null);
    }, { "once": true });
  });

  input.click();

  return picked;
}
