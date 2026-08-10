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

import { listStores } from "@/lib/browser/scopes/list-stores.ts";
import { readStoragePath } from "@/lib/browser/scopes/read-storage-path.ts";

// A replica of the 'get_locales' command from 'translations.rs'

type LocaleItemType = {
  "code": string;
  "name": string;
};

type TranslationsFileType = {
  "Info"?: {
    "Code"?: unknown;
    "Name"?: unknown;
  };
};

async function parseLocaleItem(path: string): Promise<LocaleItemType | undefined> {
  const value: string | File = await readStoragePath(path);
  const text: string = typeof value === "string" ? value : await value.text();

  try {
    const parsed: TranslationsFileType = JSON.parse(text) as TranslationsFileType;
    const code: unknown = parsed.Info?.Code;
    const name: unknown = parsed.Info?.Name;

    if (typeof code !== "string" || typeof name !== "string") {
      return undefined;
    }

    return { code, name };
  } catch {
    // Files that fail to parse are skipped, just like on the desktop side
    return undefined;
  }
}

export async function readStoredLocales(directory: string): Promise<Array<LocaleItemType>> {
  const prefix: string = directory.endsWith("/") ? directory : `${directory}/`;
  const keys: Array<string> = await listStores(prefix);
  const items: Array<LocaleItemType> = [];

  for (const key of keys) {
    const fileName: string = key.slice(prefix.length);

    if (
      fileName.length === 0 ||
      fileName.includes("/") ||
      !fileName.toLowerCase().endsWith(".json")
    ) {
      continue;
    }

    const item: LocaleItemType | undefined = await parseLocaleItem(key);

    if (item !== undefined) {
      items.push(item);
    }
  }

  return items;
}
