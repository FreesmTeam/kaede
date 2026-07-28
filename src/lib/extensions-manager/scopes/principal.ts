import { hashStringSha256Locally } from "@/lib/cryptography/local-hashes.ts";

const PLUGIN_ID_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,126}[A-Za-z0-9])?$/u;
const SHA_256_PATTERN = /^[a-f0-9]{64}$/u;
const RAW_REPOSITORY_PATH_CHARACTER_PATTERN = /^[A-Za-z0-9._~!$&'()*+,;=:@-]$/u;
const BACKEND_HOST_LABEL_PATTERN = /^[A-Za-z0-9-]+$/u;
const UNICODE_CONTROL_OR_SURROGATE_PATTERN = /[\p{Cc}\p{Cs}]/u;
const MAX_PLUGIN_VERSION_LENGTH = 128;
const RESERVED_PLUGIN_IDS = new Set([
  "__proto__",
  "prototype",
  "constructor",
]);

export type PluginPrincipal = Readonly<{
  "repositoryOrigin": string;
  "pluginId"        : string;
  "version"         : string;
  "artifactSha256"  : string;
}>;

export type PluginPrincipalInput = Readonly<{
  "repositoryOrigin": string;
  "pluginId"        : string;
  "version"         : string;
  "artifactSha256"  : string;
}>;

export type PluginArtifactInput = Readonly<{
  "repositoryOrigin": string;
  "pluginId"        : string;
  "version"         : string;
  "code"            : string;
}>;

export type PluginPrincipalKey = string;

function invalidValue(label: string, value: string): TypeError {
  return new TypeError(`Invalid ${label}: ${JSON.stringify(value)}`);
}

function isAscii(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);

    if (codePoint === undefined || codePoint > 0x7F) {
      return false;
    }
  }

  return true;
}

export function isSafePluginId(pluginId: string): boolean {
  return PLUGIN_ID_PATTERN.test(pluginId) &&
    !RESERVED_PLUGIN_IDS.has(pluginId.toLowerCase());
}

export function isValidPluginVersion(version: string): boolean {
  return version.length > 0 &&
    version.trim() === version &&
    (version.match(/[\s\S]/gu)?.length ?? 0) <= MAX_PLUGIN_VERSION_LENGTH &&
    !UNICODE_CONTROL_OR_SURROGATE_PATTERN.test(version);
}

function isAsciiAlphanumeric(byte: number): boolean {
  return (byte >= 0x30 && byte <= 0x39) ||
    (byte >= 0x41 && byte <= 0x5A) ||
    (byte >= 0x61 && byte <= 0x7A);
}

function canonicalHexValue(character: string): number | undefined {
  const codePoint = character.codePointAt(0);

  if (codePoint === undefined) {
    return undefined;
  }

  if (codePoint >= 0x30 && codePoint <= 0x39) {
    return codePoint - 0x30;
  }

  if (codePoint >= 0x41 && codePoint <= 0x46) {
    return codePoint - 0x41 + 10;
  }

  return undefined;
}

function isForbiddenPercentDecodedByte(byte: number): boolean {
  return byte <= 0x1F ||
    byte === 0x7F ||
    isAsciiAlphanumeric(byte) ||
    (byte < 0x80 && "-._~%/\\".includes(String.fromCodePoint(byte)));
}

function isCanonicalRepositoryPath(repositoryPath: string): boolean {
  if (
    repositoryPath === "/" ||
    !repositoryPath.startsWith("/") ||
    repositoryPath.endsWith("/") ||
    repositoryPath.includes("//") ||
    !isAscii(repositoryPath) ||
    repositoryPath.toLowerCase().endsWith(".git") ||
    repositoryPath.split("/").slice(1)
      .some(segment => {
        return ["", ".", ".."].includes(segment);
      })
  ) {
    return false;
  }

  const decodedPath: Array<number> = [];

  for (let index = 0; index < repositoryPath.length; index++) {
    const character = repositoryPath[index];

    if (character === "/" || RAW_REPOSITORY_PATH_CHARACTER_PATTERN.test(character)) {
      decodedPath.push(character.codePointAt(0) ?? 0);
      continue;
    }

    if (character !== "%" || index + 2 >= repositoryPath.length) {
      return false;
    }

    const high = canonicalHexValue(repositoryPath[index + 1]);
    const low = canonicalHexValue(repositoryPath[index + 2]);

    if (high === undefined || low === undefined) {
      return false;
    }

    const decoded = (high * 16) + low;

    if (isForbiddenPercentDecodedByte(decoded)) {
      return false;
    }

    decodedPath.push(decoded);
    index += 2;
  }

  try {
    const decoded = (new TextDecoder("utf-8", { "fatal": true })).decode(
      Uint8Array.from(decodedPath),
    );

    return !UNICODE_CONTROL_OR_SURROGATE_PATTERN.test(decoded);
  } catch {
    return false;
  }
}

function isBackendCompatibleHost(hostname: string): boolean {
  const unbracketed = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;

  if (unbracketed.length === 0 || !isAscii(unbracketed)) {
    return false;
  }

  // URL parsing has already validated and canonicalized bracketed IPv6 addresses.
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    return true;
  }

  return unbracketed.length <= 253 &&
    !unbracketed.startsWith(".") &&
    !unbracketed.endsWith(".") &&
    unbracketed.split(".").every(label => {
      return label.length > 0 &&
        !label.startsWith("-") &&
        !label.endsWith("-") &&
        BACKEND_HOST_LABEL_PATTERN.test(label);
    });
}

function canonicalizeBackendHost(hostname: string): string {
  const ipv4Mapped = (/^\[::ffff:([\da-f]{1,4}):([\da-f]{1,4})\]$/u).exec(hostname);

  if (ipv4Mapped === null) {
    return hostname;
  }

  const high = Number.parseInt(ipv4Mapped[1], 16);
  const low = Number.parseInt(ipv4Mapped[2], 16);

  return `[::ffff:${high >>> 8}.${high & 0xFF}.${low >>> 8}.${low & 0xFF}]`;
}

export function canonicalizeRepositoryOrigin(repositoryOrigin: string): string {
  if (
    repositoryOrigin.trim() !== repositoryOrigin ||
    repositoryOrigin.includes("\\") ||
    repositoryOrigin.includes("?") ||
    repositoryOrigin.includes("#") ||
    UNICODE_CONTROL_OR_SURROGATE_PATTERN.test(repositoryOrigin)
  ) {
    throw invalidValue("repository origin", repositoryOrigin);
  }

  const schemeSeparator = repositoryOrigin.indexOf("://");
  const repositoryPathStart = repositoryOrigin.indexOf("/", schemeSeparator + 3);

  if (
    schemeSeparator <= 0 ||
    repositoryPathStart < schemeSeparator + 3 ||
    !isCanonicalRepositoryPath(repositoryOrigin.slice(repositoryPathStart))
  ) {
    throw invalidValue("repository origin", repositoryOrigin);
  }

  const repositoryPath = repositoryOrigin.slice(repositoryPathStart);

  let parsed: URL;

  try {
    parsed = new URL(repositoryOrigin);
  } catch {
    throw invalidValue("repository origin", repositoryOrigin);
  }

  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    !isBackendCompatibleHost(parsed.hostname)
  ) {
    throw invalidValue("repository origin", repositoryOrigin);
  }

  const canonicalHost = canonicalizeBackendHost(parsed.hostname);
  const canonicalPort = parsed.port === "" ? "" : `:${parsed.port}`;

  return `${parsed.protocol}//${canonicalHost}${canonicalPort}${repositoryPath}`;
}

export function isCanonicalRepositoryOrigin(repositoryOrigin: string): boolean {
  try {
    return canonicalizeRepositoryOrigin(repositoryOrigin) === repositoryOrigin;
  } catch {
    return false;
  }
}

export async function computeArtifactSha256(code: string): Promise<string> {
  const encodedArtifact = (new TextEncoder).encode(code);
  const digest = await crypto.subtle.digest("SHA-256", encodedArtifact);

  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export function createPluginPrincipal(input: PluginPrincipalInput): PluginPrincipal {
  if (!isSafePluginId(input.pluginId)) {
    throw invalidValue("plugin ID", input.pluginId);
  }

  if (!isValidPluginVersion(input.version)) {
    throw invalidValue("plugin version", input.version);
  }

  if (!SHA_256_PATTERN.test(input.artifactSha256)) {
    throw invalidValue("artifact SHA-256", input.artifactSha256);
  }

  return Object.freeze({
    "repositoryOrigin": canonicalizeRepositoryOrigin(input.repositoryOrigin),
    "pluginId"        : input.pluginId,
    "version"         : input.version,
    "artifactSha256"  : input.artifactSha256,
  });
}

export async function createPluginPrincipalFromArtifact(
  input: PluginArtifactInput,
): Promise<PluginPrincipal> {
  return createPluginPrincipal({
    "repositoryOrigin": input.repositoryOrigin,
    "pluginId"        : input.pluginId,
    "version"         : input.version,
    "artifactSha256"  : await computeArtifactSha256(input.code),
  });
}

function keySegment(value: string): string {
  return `${value.length}:${value}`;
}

export function createPluginPrincipalKey(principal: PluginPrincipal): PluginPrincipalKey {
  const canonicalPrincipal = createPluginPrincipal(principal);
  const serializedPrincipal = [
    canonicalPrincipal.repositoryOrigin,
    canonicalPrincipal.pluginId,
    canonicalPrincipal.version,
    canonicalPrincipal.artifactSha256,
  ].map(value => keySegment(value)).join("|");

  return `plugin-principal-v2:sha256:${hashStringSha256Locally(serializedPrincipal)}`;
}
