function isCanonicalPosixAbsolutePath(filePath: string): boolean {
  if (!filePath.startsWith("/") || filePath.includes("\\")) {
    return false;
  }

  if (filePath === "/") {
    return true;
  }

  if (filePath.endsWith("/") || filePath.includes("//")) {
    return false;
  }

  return filePath
    .slice(1)
    .split("/")
    .every(segment => segment !== "" && segment !== "." && segment !== "..");
}

function isCanonicalWindowsAbsolutePath(filePath: string): boolean {
  if (!(/^[A-Z]:\\/u).test(filePath) || filePath.includes("/")) {
    return false;
  }

  if (filePath.length === 3) {
    return true;
  }

  const pathWithoutDrive = filePath.slice(3);

  if (pathWithoutDrive.endsWith("\\") || pathWithoutDrive.includes("\\\\")) {
    return false;
  }

  return pathWithoutDrive
    .split("\\")
    .every(segment => segment !== "" && segment !== "." && segment !== "..");
}

function hasAsciiControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);

    if (codePoint !== undefined && (codePoint === 0x7F || codePoint <= 0x1F)) {
      return true;
    }
  }

  return false;
}

export function isCanonicalAbsolutePath(filePath: string): boolean {
  return filePath.length > 0 &&
    !hasAsciiControlCharacter(filePath) &&
    (isCanonicalPosixAbsolutePath(filePath) || isCanonicalWindowsAbsolutePath(filePath));
}
