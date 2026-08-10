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

import { digestBytes } from "@/lib/browser/scopes/digest-bytes.ts";
import { readStoredArchive } from "@/lib/browser/scopes/handle-archives.ts";
import { listStores } from "@/lib/browser/scopes/list-stores.ts";
import {
  listZipEntries,
  readZipEntry,
  type ZipEntryType,
} from "@/lib/browser/scopes/parse-zip.ts";

// A replica of the 'read_extensions' command from 'extensions.rs'

const MetadataEntry: string = "metadata.json";
const CodeEntry: string = "index.js";
const MaxMetadataSize: number = 64 * 1024;
const MaxCodeSize: number = 16 * 1024 * 1024;

type ExtensionFileType = {
  "fileName"  : string;
  "metadata"  : unknown;
  "code"      : string;
  "codeSha256": string;
};

type ExtensionFailureType = {
  "fileName": string;
  "error"   : string;
};

function isExtensionArchive(fileName: string): boolean {
  const lowercase: string = fileName.toLowerCase();

  return lowercase.endsWith(".zip") || lowercase.endsWith(".kaede");
}

async function readEntryText(
  bytes: Uint8Array,
  entries: Array<ZipEntryType>,
  entryName: string,
  maxSize: number,
): Promise<string> {
  const entry: ZipEntryType | undefined = entries.find(({ name }) => name === entryName);

  if (!entry) {
    throw `Could not find '${entryName}' at the archive root`;
  }

  if (entry.uncompressedSize > maxSize) {
    throw `'${entryName}' declares ${entry.uncompressedSize} bytes ` +
      `which exceeds the ${maxSize} bytes limit`;
  }

  const inflated: Uint8Array = await readZipEntry(bytes, entry);

  if (inflated.length > maxSize) {
    throw `'${entryName}' decompressed past the ${maxSize} bytes limit`;
  }

  const contents: string = (new TextDecoder).decode(inflated);

  // Strip the UTF-8 BOM
  if (contents.startsWith("\uFEFF")) {
    return contents.slice(1);
  }

  return contents;
}

async function readOneExtension(path: string, fileName: string): Promise<ExtensionFileType> {
  const bytes: Uint8Array = await readStoredArchive(path);
  const entries: Array<ZipEntryType> = listZipEntries(bytes);
  const metadataText: string = await readEntryText(bytes, entries, MetadataEntry, MaxMetadataSize);
  const code: string = await readEntryText(bytes, entries, CodeEntry, MaxCodeSize);

  let metadata: unknown;

  try {
    metadata = JSON.parse(metadataText);
  } catch (error) {
    throw `Could not parse '${MetadataEntry}': ${String(error)}`;
  }

  return {
    fileName,
    metadata,
    code,
    "codeSha256": await digestBytes("SHA-256", (new TextEncoder).encode(code)),
  };
}

export async function readStoredExtensions(extensionsDirectoryPath: string): Promise<{
  "extensions": Array<ExtensionFileType>;
  "failures"  : Array<ExtensionFailureType>;
}> {
  const prefix: string = extensionsDirectoryPath.endsWith("/")
    ? extensionsDirectoryPath
    : `${extensionsDirectoryPath}/`;
  const keys: Array<string> = await listStores(prefix);
  const extensions: Array<ExtensionFileType> = [];
  const failures: Array<ExtensionFailureType> = [];

  for (const key of keys) {
    const fileName: string = key.slice(prefix.length);

    // Nested paths are not direct children of the extensions directory
    if (fileName.length === 0 || fileName.includes("/") || !isExtensionArchive(fileName)) {
      continue;
    }

    try {
      extensions.push(await readOneExtension(key, fileName));
    } catch (error) {
      failures.push({
        fileName,
        "error": String(error),
      });
    }
  }

  return { extensions, failures };
}
