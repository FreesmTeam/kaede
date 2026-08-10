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

import {
  isSafeZipEntryName,
  listZipEntries,
  readZipEntry,
  type ZipEntryType,
} from "@/lib/browser/scopes/parse-zip.ts";
import { readStoredBytes } from "@/lib/browser/scopes/read-stored-bytes.ts";
import { writeToStoragePath } from "@/lib/browser/scopes/write-to-storage-path.ts";

export async function readStoredArchive(path: string): Promise<Uint8Array> {
  const bytes: Uint8Array | undefined = await readStoredBytes(path);

  if (bytes === undefined) {
    throw `Failed to open ${path}: it does not exist in the browser storage`;
  }

  return bytes;
}

async function writeEntryToStorage(
  bytes: Uint8Array,
  entry: ZipEntryType,
  path: string,
): Promise<void> {
  const contents: Uint8Array = await readZipEntry(bytes, entry);
  const name: string = path.split("/").pop() ?? path;

  await writeToStoragePath(path, new File([contents], name));
}

// A replica of the 'read_archive_entry' command from 'zip.rs'
export async function readArchiveEntryReplica(
  archivePath: string,
  entryPath: string,
): Promise<Array<number> | null> {
  const bytes: Uint8Array = await readStoredArchive(archivePath);
  const entries: Array<ZipEntryType> = listZipEntries(bytes);
  const entry: ZipEntryType | undefined = entries.find(({ name }) => name === entryPath);

  if (!entry || entry.isDirectory) {
    return null;
  }

  // The desktop command answers with a plain 'Vec<u8>' array
  return [...await readZipEntry(bytes, entry)];
}

// A replica of the 'unzip_files' command from 'zip.rs'
export async function unzipStoredFiles(
  archiveFiles: Array<{
    "path"   : string;
    "exclude": Array<string>;
  }>,
  targetDirectoryPath: string,
): Promise<true | string> {
  const errors: Array<string> = [];

  for (const archiveFile of archiveFiles) {
    try {
      const bytes: Uint8Array = await readStoredArchive(archiveFile.path);
      const entries: Array<ZipEntryType> = listZipEntries(bytes);

      for (const entry of entries) {
        // '.exclude' entries are path prefixes, e.g. "META-INF/"
        const excluded: boolean = archiveFile.exclude.some(
          prefix => entry.name.startsWith(prefix),
        );

        // Directories are skipped since the browser storage has no directory records
        if (excluded || entry.isDirectory || !isSafeZipEntryName(entry.name)) {
          continue;
        }

        await writeEntryToStorage(bytes, entry, `${targetDirectoryPath}/${entry.name}`);
      }
    } catch (error) {
      errors.push(String(error));
    }
  }

  if (errors.length === 0) {
    return true;
  }

  return errors.join("\n");
}
