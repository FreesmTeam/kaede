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

/*
 * A small zip reader that replicates what the desktop side does
 * with the 'zip' crate. Entries are located through the central
 * directory and are inflated with the built-in 'DecompressionStream'.
 *
 * ZIP64 archives (4 GiB and larger) are not supported,
 * which is fine for jars, modpacks, and extension archives
 */

export type ZipEntryType = {
  "name"            : string;
  "isDirectory"     : boolean;
  "method"          : number;
  "compressedSize"  : number;
  "uncompressedSize": number;
  "headerOffset"    : number;
};

const EndOfCentralDirectorySignature: number = 0x06_05_4B_50;
const CentralDirectorySignature: number = 0x02_01_4B_50;
const LocalFileHeaderSignature: number = 0x04_03_4B_50;
// The fixed part of each header, in bytes
const EndOfCentralDirectoryLength: number = 22;
const CentralDirectoryEntryLength: number = 46;
const LocalFileHeaderLength: number = 30;
const StoredMethod: number = 0;
const DeflatedMethod: number = 8;
// The zip comment length is stored in two bytes
const MaxCommentLength: number = 65_535;

function findEndOfCentralDirectory(view: DataView): number | undefined {
  const earliest: number = Math.max(
    0,
    view.byteLength - EndOfCentralDirectoryLength - MaxCommentLength,
  );

  for (let offset = view.byteLength - EndOfCentralDirectoryLength; offset >= earliest; offset--) {
    if (view.getUint32(offset, true) === EndOfCentralDirectorySignature) {
      return offset;
    }
  }

  return undefined;
}

// Rejects entry names that would escape the extraction target ("zip slip")
export function isSafeZipEntryName(name: string): boolean {
  if (name.startsWith("/") || name.includes("\\")) {
    return false;
  }

  return name
    .split("/")
    .every(part => part !== "..");
}

export function listZipEntries(bytes: Uint8Array): Array<ZipEntryType> {
  if (bytes.length < EndOfCentralDirectoryLength) {
    throw "The file is too small to be a zip archive";
  }

  const view: DataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const endOffset: number | undefined = findEndOfCentralDirectory(view);

  if (endOffset === undefined) {
    throw "The file is not a zip archive: the end of central directory record is missing";
  }

  const count: number = view.getUint16(endOffset + 10, true);
  const decoder: TextDecoder = new TextDecoder;
  const entries: Array<ZipEntryType> = [];

  let pointer: number = view.getUint32(endOffset + 16, true);

  for (let index = 0; index < count; index++) {
    if (
      pointer + CentralDirectoryEntryLength > view.byteLength ||
      view.getUint32(pointer, true) !== CentralDirectorySignature
    ) {
      throw `Failed to read entry #${index}: the central directory is corrupt`;
    }

    const method: number = view.getUint16(pointer + 10, true);
    const compressedSize: number = view.getUint32(pointer + 20, true);
    const uncompressedSize: number = view.getUint32(pointer + 24, true);
    const nameLength: number = view.getUint16(pointer + 28, true);
    const extraLength: number = view.getUint16(pointer + 30, true);
    const commentLength: number = view.getUint16(pointer + 32, true);
    const headerOffset: number = view.getUint32(pointer + 42, true);
    const nameStart: number = pointer + CentralDirectoryEntryLength;
    const name: string = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength));

    entries.push({
      name,
      "isDirectory": name.endsWith("/"),
      method,
      compressedSize,
      uncompressedSize,
      headerOffset,
    });

    pointer = nameStart + nameLength + extraLength + commentLength;
  }

  return entries;
}

export async function readZipEntry(bytes: Uint8Array, entry: ZipEntryType): Promise<Uint8Array> {
  const view: DataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (view.getUint32(entry.headerOffset, true) !== LocalFileHeaderSignature) {
    throw `Failed to read the '${entry.name}' entry: the local file header is corrupt`;
  }

  /*
   * Name and extra field lengths are read from the local header since
   * the extra field is allowed to differ from the central directory one
   */
  const nameLength: number = view.getUint16(entry.headerOffset + 26, true);
  const extraLength: number = view.getUint16(entry.headerOffset + 28, true);
  const dataStart: number = entry.headerOffset + LocalFileHeaderLength + nameLength + extraLength;
  const compressed: Uint8Array = bytes.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.method === StoredMethod) {
    // The typed array constructor copies the subarray into a new buffer
    return new Uint8Array(compressed);
  }

  if (entry.method !== DeflatedMethod) {
    throw `The '${entry.name}' entry uses an unsupported compression method (${entry.method})`;
  }

  const inflated: ReadableStream<Uint8Array> = new Blob([new Uint8Array(compressed)])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  const buffer: ArrayBuffer = await (new Response(inflated)).arrayBuffer();

  return new Uint8Array(buffer);
}
