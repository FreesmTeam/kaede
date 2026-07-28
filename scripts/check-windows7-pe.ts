const DosSignature = 0x5A_4D;
const PeSignature = 0x45_50;
const Amd64Machine = 0x86_64;
const Pe32Magic = 0x01_0B;
const Pe32PlusMagic = 0x02_0B;
const MaximumSubsystemMajor = 6;
const MaximumSubsystemMinor = 1;

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

  process.stdout.write(
    `Verified ${filePath}: AMD64 PE subsystem ${subsystemMajor}.${subsystemMinor} <= 6.1\n`,
  );
}

const filePaths = process.argv.slice(2);

if (filePaths.length === 0) {
  throw new Error("Usage: bun scripts/check-windows7-pe.ts <file.exe> [file.exe ...]");
}

for (const filePath of filePaths) {
  await checkWindows7Pe(filePath);
}
