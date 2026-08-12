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

import { readStoredArchive } from "@/lib/browser/scopes/handle-archives.ts";
import {
  isSafeZipEntryName,
  listZipEntries,
  readZipEntry,
  type ZipEntryType,
} from "@/lib/browser/scopes/parse-zip.ts";
import { writeToStoragePath } from "@/lib/browser/scopes/write-to-storage-path.ts";

// A replica of the 'modrinth.rs' module

const ManifestEntry: string = "modrinth.index.json";
const OverridePrefixes: Array<string> = ["overrides/", "client-overrides/"];
const TrustedPrefix: string = "https://cdn.modrinth.com/";

type RawFileType = {
  "path"?  : string;
  "hashes"?   : {
    "sha1"?  : string;
    "sha512"?: string;
  };
  "downloads"?: Array<string>;
  "fileSize"? : number;
};

type RawIndexType = {
  "formatVersion"?: number;
  "name"?         : string;
  "versionId"?    : string;
  "summary"?      : string;
  "dependencies"? : Record<string, string>;
  "files"?        : Array<RawFileType>;
};

type ManifestFileType = {
  "path"    : string;
  "url"     : string;
  "fileSize": number;
  "sha1"    : string;
  "sha512"  : string;
  "external": boolean;
};

type MrpackManifestType = {
  "formatVersion": number;
  "name"         : string;
  "versionId"    : string;
  "summary"      : string | null;
  "dependencies" : Record<string, string>;
  "files"        : Array<ManifestFileType>;
  "overrides"    : number;
};

function mapManifestFile(raw: RawFileType): ManifestFileType | undefined {
  const url: string | undefined = raw.downloads?.find(
    download => download.startsWith("https://"),
  );

  if (url === undefined) {
    return undefined;
  }

  return {
    "external": !url.startsWith(TrustedPrefix),
    "path"    : raw.path ?? "",
    url,
    "fileSize": raw.fileSize ?? 0,
    "sha1"    : raw.hashes?.sha1 ?? "",
    "sha512"  : raw.hashes?.sha512 ?? "",
  };
}

function buildManifest(raw: RawIndexType, overrides: number): MrpackManifestType {
  const files: Array<ManifestFileType> = [];

  for (const file of raw.files ?? []) {
    const mapped: ManifestFileType | undefined = mapManifestFile(file);

    if (mapped !== undefined) {
      files.push(mapped);
    }
  }

  return {
    "formatVersion": raw.formatVersion ?? 0,
    "name"         : raw.name ?? "",
    "versionId"    : raw.versionId ?? "",
    "summary"      : raw.summary ?? null,
    "dependencies" : raw.dependencies ?? {},
    files,
    overrides,
  };
}

async function readManifest(
  bytes: Uint8Array,
  entries: Array<ZipEntryType>,
  archivePath: string,
): Promise<RawIndexType> {
  const entry: ZipEntryType | undefined = entries.find(({ name }) => name === ManifestEntry);

  if (!entry) {
    throw `Failed to read '${ManifestEntry}' in ${archivePath}: the entry is missing`;
  }

  const contents: Uint8Array = await readZipEntry(bytes, entry);
  const text: string = (new TextDecoder).decode(contents);

  try {
    return JSON.parse(text) as RawIndexType;
  } catch (error) {
    throw `Failed to parse '${ManifestEntry}': ${String(error)}`;
  }
}

export async function peekMrpackReplica(archivePath: string): Promise<MrpackManifestType | null> {
  const bytes: Uint8Array = await readStoredArchive(archivePath);
  const entries: Array<ZipEntryType> = listZipEntries(bytes);

  if (!entries.some(({ name }) => name === ManifestEntry)) {
    return null;
  }

  const manifest: RawIndexType = await readManifest(bytes, entries, archivePath);

  return buildManifest(manifest, 0);
}

export async function installMrpackReplica(
  archivePath: string,
  targetDirectoryPath: string,
): Promise<MrpackManifestType> {
  const bytes: Uint8Array = await readStoredArchive(archivePath);
  const entries: Array<ZipEntryType> = listZipEntries(bytes);
  const manifest: RawIndexType = await readManifest(bytes, entries, archivePath);

  let overrides: number = 0;

  for (const entry of entries) {
    if (entry.isDirectory || !isSafeZipEntryName(entry.name)) {
      continue;
    }

    const prefix: string | undefined = OverridePrefixes.find(
      overridePrefix => entry.name.startsWith(overridePrefix),
    );

    if (prefix === undefined) {
      continue;
    }

    const relativePath: string = entry.name.slice(prefix.length);

    if (relativePath.length === 0) {
      continue;
    }

    const contents: Uint8Array = await readZipEntry(bytes, entry);
    const name: string = relativePath.split("/").pop() ?? relativePath;

    await writeToStoragePath(
      `${targetDirectoryPath}/${relativePath}`,
      new File([contents], name),
    );

    overrides = overrides + 1;
  }

  return buildManifest(manifest, overrides);
}
