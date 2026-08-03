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
const ForbiddenImportNames = new Set([
  // WinRT / COM base (Windows 8+)
  "combase.dll",
  // OS-bundled ICU internationalization libraries (Windows 10 1703+);
  // often pulled in by localization or collation code
  "icu.dll",
  "icuuc.dll",
  "icuin.dll",
]);
const ForbiddenImportPrefixes = [
  // WinRT API sets (Windows 8+)
  "api-ms-win-core-winrt",
  // Path API set (Windows 8+); famously broke Python 3.9 on Windows 7
  "api-ms-win-core-path",
];

// Functions that exist on Windows 8+ but are missing from the Windows 7
// builds of these DLLs. The DLL loads fine, but the loader fails with
// "procedure entry point ... could not be located" before main() runs.
const ForbiddenFunctions = new Map<string, Set<string>>([
  ["kernel32.dll", new Set([
    "CreateFile2",
    "CopyFile2",
    "GetSystemTimePreciseAsFileTime",
    "GetOverlappedResultEx",
    "WaitOnAddress",
    "WakeByAddressSingle",
    "WakeByAddressAll",
    "PrefetchVirtualMemory",
    "GetProcessMitigationPolicy",
    "SetProcessMitigationPolicy",
    "GetProcessInformation",
    "SetProcessInformation",
    "GetThreadInformation",
    "SetThreadInformation",
    "CreateFileMappingFromApp",
    "MapViewOfFileFromApp",
  ])],
  ["ole32.dll", new Set([
    "CoIncrementMTAUsage",
    "CoDecrementMTAUsage",
  ])],
]);

// Functions that are missing from a stock Windows 7 SP1 install but are
// added by a specific optional update. Importing these does not fail the
// check; the required update is reported so it can be documented as a
// prerequisite. (e.g. the WebView2 loader's TraceLogging usage.)
const UpdateGatedFunctions = new Map<string, Map<string, string>>([
  ["advapi32.dll", new Map([
    // Imported by Microsoft's WebView2 loader (TraceLogging); the function is
    // Windows 8+ but was backported to Windows 7 by this telemetry update.
    ["EventSetInformation", "KB3080149 (backports EventSetInformation)"],
  ])],
]);

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

interface DllImport {
  dllName: string;
  functionNames: string[];
}

function collectImportedDlls(
  bytes: Uint8Array,
  view: DataView,
  peOffset: number,
  optionalHeaderOffset: number,
  optionalHeaderSize: number,
): DllImport[] {
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
  const dllImports: DllImport[] = [];

  if (importTableRva === 0) {
    return dllImports;
  }

  let descriptorOffset = rvaToFileOffset(sections, importTableRva);

  for (;;) {
    requireRange(bytes.byteLength, descriptorOffset, 20, "import descriptor");

    const importLookupTableRva = view.getUint32(descriptorOffset, true);
    const nameRva = view.getUint32(descriptorOffset + 12, true);
    const importAddressTableRva = view.getUint32(descriptorOffset + 16, true);

    if (nameRva === 0) {
      break;
    }

    const dllName = readCString(bytes, rvaToFileOffset(sections, nameRva));
    const functionNames: string[] = [];
    let thunkOffset = rvaToFileOffset(
      sections,
      importLookupTableRva || importAddressTableRva,
    );

    // 64-bit thunks: high bit set means import-by-ordinal, otherwise the
    // low 31 bits are an RVA to a hint/name entry (name starts at +2).
    for (;;) {
      requireRange(bytes.byteLength, thunkOffset, 8, `import thunk of ${dllName}`);

      const thunkLow = view.getUint32(thunkOffset, true);
      const thunkHigh = view.getUint32(thunkOffset + 4, true);

      if (thunkLow === 0 && thunkHigh === 0) {
        break;
      }

      if ((thunkHigh & 0x80_00_00_00) === 0) {
        functionNames.push(readCString(bytes, rvaToFileOffset(sections, thunkLow) + 2));
      }

      thunkOffset += 8;
    }

    dllImports.push({ dllName, functionNames });
    descriptorOffset += 20;
  }

  return dllImports;
}

function isForbiddenOnWindows7(dllName: string): boolean {
  const normalized = dllName.toLowerCase();

  return ForbiddenImportNames.has(normalized)
    || ForbiddenImportPrefixes.some((prefix) => normalized.startsWith(prefix));
}

async function checkWindows7Pe(filePath: string, lenient: boolean): Promise<void> {
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
  const problems: string[] = [];
  const requiredUpdates: string[] = [];

  for (const { dllName, functionNames } of importedDlls) {
    const updateGated = UpdateGatedFunctions.get(dllName.toLowerCase());

    if (updateGated !== undefined) {
      for (const functionName of functionNames) {
        const update = updateGated.get(functionName);

        if (update !== undefined) {
          requiredUpdates.push(`${dllName}!${functionName} requires ${update}`);
        }
      }
    }

    if (isForbiddenOnWindows7(dllName)) {
      problems.push(
        `${dllName} does not exist on Windows 7 `
        + `(imported: ${functionNames.slice(0, 8).join(", ")}`
        + `${functionNames.length > 8 ? ", ..." : ""})`,
      );
      continue;
    }

    const forbiddenFunctions = ForbiddenFunctions.get(dllName.toLowerCase());

    if (forbiddenFunctions === undefined) {
      continue;
    }

    const missingOnWindows7 = functionNames.filter(
      (functionName) => forbiddenFunctions.has(functionName),
    );

    if (missingOnWindows7.length > 0) {
      problems.push(
        `${dllName} lacks these functions on Windows 7: `
        + missingOnWindows7.join(", "),
      );
    }
  }

  if (problems.length > 0) {
    const report = `${filePath} is not Windows 7 compatible:\n  - ${problems.join("\n  - ")}`;

    if (!lenient) {
      throw new Error(report);
    }

    process.stderr.write(`WARNING (lenient mode): ${report}\n`);
    return;
  }

  for (const requiredUpdate of requiredUpdates) {
    process.stdout.write(
      `NOTE: ${filePath} needs a Windows 7 update: ${requiredUpdate}\n`,
    );
  }

  const importedFunctionCount = importedDlls
    .reduce((total, { functionNames }) => total + functionNames.length, 0);

  process.stdout.write(
    `Verified ${filePath}: AMD64 PE subsystem ${subsystemMajor}.${subsystemMinor} <= 6.1, `
    + `${importedDlls.length} DLLs / ${importedFunctionCount} functions imported, `
    + "none Windows 8+-only\n",
  );
}

const cliArguments = process.argv.slice(2);
const lenient = cliArguments.includes("--lenient");
const filePaths = cliArguments.filter((argument) => argument !== "--lenient");

if (filePaths.length === 0) {
  throw new Error(
    "Usage: bun scripts/check-windows-7-pe.ts [--lenient] <file.exe> [file.exe ...]",
  );
}

for (const filePath of filePaths) {
  // @ts-expect-error It works
  await checkWindows7Pe(filePath, lenient);
}
