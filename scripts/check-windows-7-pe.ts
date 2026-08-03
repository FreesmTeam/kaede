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

const DosSignature = 0x5A_4D;
const PeSignature = 0x45_50;
const Amd64Machine = 0x86_64;
const Pe32Magic = 0x01_0B;
const Pe32PlusMagic = 0x02_0B;
const MaximumSubsystemMajor = 6;
const MaximumSubsystemMinor = 1;

// DLLs that do not exist on Windows 7. Importing any of these makes the
// loader fail with a "missing DLL" dialog before the process even starts.
const ForbiddenImportNames = new Set(["combase.dll"]);
const ForbiddenImportPrefixes = [
  // WinRT API sets (Windows 8+)
  "api-ms-win-core-winrt",
];

function requireRange(
  byteLength: number,
  offset: number,
  length: number,
  label: string,
): void {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset + length > byteLength) {
    throw new Error(`${label} is outside the PE file`);
  }
}

function isNewerThanWindows7(major: number, minor: number): boolean {
  return major > MaximumSubsystemMajor
    || (major === MaximumSubsystemMajor && minor > MaximumSubsystemMinor);
}

interface Section {
  virtualAddress: number;
  virtualSize: number;
  rawDataOffset: number;
  rawDataSize: number;
}

function rvaToFileOffset(sections: Section[], rva: number): number {
  for (const section of sections) {
    const sectionSpan = Math.max(section.virtualSize, section.rawDataSize);

    if (rva >= section.virtualAddress && rva < section.virtualAddress + sectionSpan) {
      return rva - section.virtualAddress + section.rawDataOffset;
    }
  }

  throw new Error(`RVA 0x${rva.toString(16)} is not mapped by any section`);
}

function readCString(bytes: Uint8Array, offset: number): string {
  let end = offset;

  while (end < bytes.byteLength && bytes[end] !== 0) {
    end += 1;
  }

  return new TextDecoder("ascii").decode(bytes.subarray(offset, end));
}

function collectImportedDlls(
  bytes: Uint8Array,
  view: DataView,
  peOffset: number,
  optionalHeaderOffset: number,
  optionalHeaderSize: number,
): string[] {
  const sectionCount = view.getUint16(peOffset + 6, true);
  const sectionTableOffset = optionalHeaderOffset + optionalHeaderSize;
  const sections: Section[] = [];

  for (let index = 0; index < sectionCount; index += 1) {
    const entryOffset = sectionTableOffset + index * 40;

    requireRange(bytes.byteLength, entryOffset, 40, `section header ${index}`);
    sections.push({
      virtualSize: view.getUint32(entryOffset + 8, true),
      virtualAddress: view.getUint32(entryOffset + 12, true),
      rawDataSize: view.getUint32(entryOffset + 16, true),
      rawDataOffset: view.getUint32(entryOffset + 20, true),
    });
  }

  // Import table is data directory 1; for PE32+ the directories start
  // 112 bytes into the optional header.
  const importDirectoryOffset = optionalHeaderOffset + 112 + 8;

  requireRange(bytes.byteLength, importDirectoryOffset, 8, "import data directory");

  const importTableRva = view.getUint32(importDirectoryOffset, true);
  const dllNames: string[] = [];

  if (importTableRva === 0) {
    return dllNames;
  }

  let descriptorOffset = rvaToFileOffset(sections, importTableRva);

  for (;;) {
    requireRange(bytes.byteLength, descriptorOffset, 20, "import descriptor");

    const nameRva = view.getUint32(descriptorOffset + 12, true);

    if (nameRva === 0) {
      break;
    }

    dllNames.push(readCString(bytes, rvaToFileOffset(sections, nameRva)));
    descriptorOffset += 20;
  }

  return dllNames;
}

function isForbiddenOnWindows7(dllName: string): boolean {
  const normalized = dllName.toLowerCase();

  return ForbiddenImportNames.has(normalized)
    || ForbiddenImportPrefixes.some((prefix) => normalized.startsWith(prefix));
}

async function checkWindows7Pe(filePath: string): Promise<void> {
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    throw new Error(`PE file does not exist: ${filePath}`);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  requireRange(bytes.byteLength, 0, 0x40, "DOS header");
  if (view.getUint16(0, true) !== DosSignature) {
    throw new Error(`${filePath} does not have an MZ header`);
  }

  const peOffset = view.getUint32(0x3C, true);

  requireRange(bytes.byteLength, peOffset, 24, "PE and COFF headers");
  if (view.getUint32(peOffset, true) !== PeSignature) {
    throw new Error(`${filePath} does not have a PE signature`);
  }

  const machine = view.getUint16(peOffset + 4, true);

  if (machine !== Amd64Machine) {
    throw new Error(
      `${filePath} has machine 0x${machine.toString(16)}, expected AMD64 0x8664`,
    );
  }

  const optionalHeaderSize = view.getUint16(peOffset + 20, true);

  if (optionalHeaderSize < 70) {
    throw new Error(`${filePath} has a truncated PE optional header`);
  }

  const optionalHeaderOffset = peOffset + 24;

  requireRange(
    bytes.byteLength,
    optionalHeaderOffset,
    optionalHeaderSize,
    "PE optional header",
  );

  const optionalHeaderMagic = view.getUint16(optionalHeaderOffset, true);

  if (optionalHeaderMagic !== Pe32Magic && optionalHeaderMagic !== Pe32PlusMagic) {
    throw new Error(
      `${filePath} has unsupported PE optional-header magic 0x${optionalHeaderMagic.toString(16)}`,
    );
  }

  const subsystemMajor = view.getUint16(optionalHeaderOffset + 48, true);
  const subsystemMinor = view.getUint16(optionalHeaderOffset + 50, true);

  if (isNewerThanWindows7(subsystemMajor, subsystemMinor)) {
    throw new Error(
      `${filePath} requires subsystem ${subsystemMajor}.${subsystemMinor}; `
      + `Windows 7 supports at most ${MaximumSubsystemMajor}.${MaximumSubsystemMinor}`,
    );
  }

  const importedDlls = collectImportedDlls(
    bytes,
    view,
    peOffset,
    optionalHeaderOffset,
    optionalHeaderSize,
  );
  const forbiddenImports = importedDlls.filter(element => isForbiddenOnWindows7(element));

  if (forbiddenImports.length > 0) {
    throw new Error(
      `${filePath} imports DLLs that do not exist on Windows 7: `
      + `${forbiddenImports.join(", ")}`,
    );
  }

  process.stdout.write(
    `Verified ${filePath}: AMD64 PE subsystem ${subsystemMajor}.${subsystemMinor} <= 6.1, `
    + `${importedDlls.length} imported DLLs, none Win8+-only\n`,
  );
}

const filePaths = process.argv.slice(2);

if (filePaths.length === 0) {
  throw new Error("Usage: bun scripts/check-windows7-pe.ts <file.exe> [file.exe ...]");
}

for (const filePath of filePaths) {
  // @ts-expect-error It works
  await checkWindows7Pe(filePath);
}
