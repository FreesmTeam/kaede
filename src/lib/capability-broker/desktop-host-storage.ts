import type { BrokerCall } from "@/lib/capability-broker/desktop-codecs.ts";
import {
  expectResponse,
} from "@/lib/capability-broker/desktop-codecs.ts";
import {
  toFileMetadata,
  toInstalledExtensionsReadResult,
} from "@/lib/capability-broker/desktop-host-codecs.ts";
import type {
  DirectoryEntry,
  HostFacade,
} from "@/lib/capability-broker/types.ts";

export type DesktopHostStorage = Readonly<{
  "files"     : HostFacade["files"];
  "assets"    : HostFacade["assets"];
  "archives"  : HostFacade["archives"];
  "extensions": HostFacade["extensions"];
}>;

type VerifySha1Input = Parameters<HostFacade["files"]["verifySha1"]>[0];
type RenameInput = Parameters<HostFacade["files"]["rename"]>[0];
type EnsureDirectoriesOptions = NonNullable<
  Parameters<HostFacade["files"]["ensureDirectories"]>[1]
>;
type PickIconInput = Parameters<HostFacade["assets"]["pickAndCopyInstanceIcon"]>[0];
type ExtractZipInput = Parameters<HostFacade["archives"]["extractZip"]>[0];

export function createDesktopHostStorage(call: BrokerCall): DesktopHostStorage {
  return Object.freeze({
    "files": Object.freeze({
      "exists": async (path: string): Promise<boolean> => {
        return expectResponse(
          await call({ "kind": "host_fs_exists", path, "baseDirectory": null }),
          "exists",
        ).exists;
      },
      "existsMany": async (paths: ReadonlyArray<string>): Promise<ReadonlyArray<boolean>> => {
        const response = expectResponse(
          await call({ "kind": "host_fs_exists_many", paths, "baseDirectory": null }),
          "booleans",
        );

        return Object.freeze([...response.values]);
      },
      "getMetadata": async (path: string) => {
        const response = expectResponse(await call({
          "kind"         : "host_fs_metadata",
          path,
          "baseDirectory": null,
        }), "file_metadata");

        return toFileMetadata(response.modifiedTimeMilliseconds);
      },
      "findMissing": async (paths: ReadonlyArray<string>): Promise<ReadonlyArray<string>> => {
        const response = expectResponse(await call({ "kind": "missing_paths", paths }), "paths");

        return Object.freeze([...response.paths]);
      },
      "verifySha1": async (artifacts: VerifySha1Input) => {
        const requestArtifacts = artifacts.map(({ path, hash }) => ({ path, hash }));
        const response = expectResponse(
          await call({ "kind": "verify_sha1", "artifacts": requestArtifacts }),
          "paths",
        );

        return Object.freeze([...response.paths]);
      },
      "readDirectory": async (path: string): Promise<ReadonlyArray<DirectoryEntry>> => {
        const response = expectResponse(
          await call({ "kind": "host_fs_read_dir", path, "baseDirectory": null }),
          "directory_entries",
        );

        return Object.freeze(response.entries.map(entry => Object.freeze({ ...entry })));
      },
      "readText": async (path: string): Promise<string> => {
        return expectResponse(
          await call({ "kind": "host_fs_read_text", path, "baseDirectory": null }),
          "text",
        ).text;
      },
      "readBytes": async (path: string): Promise<Uint8Array> => {
        const response = expectResponse(
          await call({ "kind": "host_fs_read_bytes", path, "baseDirectory": null }),
          "bytes",
        );

        return Uint8Array.from(response.bytes);
      },
      "writeText": async (path: string, contents: string): Promise<void> => {
        expectResponse(await call({
          "kind"         : "host_fs_write_text",
          path,
          contents,
          "baseDirectory": null,
        }), "unit");
      },
      "rename": async ({ from, to }: RenameInput): Promise<void> => {
        expectResponse(await call({
          "kind"         : "host_fs_rename",
          "source"       : from,
          "destination"  : to,
          "baseDirectory": null,
        }), "unit");
      },
      "ensureDirectories": async (
        paths: ReadonlyArray<string>,
        options?: EnsureDirectoriesOptions,
      ): Promise<void> => {
        expectResponse(await call({
          "kind"         : "host_fs_ensure_directories",
          paths,
          "baseDirectory": null,
          "recursive"    : options?.recursive ?? false,
        }), "unit");
      },
    }),
    "assets": Object.freeze({
      "pickAndCopyInstanceIcon": async (input: PickIconInput) => {
        const result = expectResponse(await call({
          "kind"                : "host_pick_and_copy_icon",
          "destinationDirectory": input.destinationDirectory,
          "allowedExtensions"   : input.allowedExtensions,
          "title"               : input.title ?? null,
        }), "icon_picked").icon;

        return result === null
          ? null
          : Object.freeze({ "path": result.path, "bytes": Uint8Array.from(result.bytes) });
      },
    }),
    "archives": Object.freeze({
      "extractZip": async ({
        archivePath,
        destinationPath,
      }: ExtractZipInput): Promise<void> => {
        expectResponse(await call({
          "kind"           : "unzip",
          "archive"        : archivePath,
          "targetDirectory": destinationPath,
        }), "unit");
      },
    }),
    "extensions": Object.freeze({
      "readInstalledArchives": async () => {
        const response = expectResponse(
          await call({ "kind": "host_read_extensions" }),
          "extensions_read",
        );

        return toInstalledExtensionsReadResult(response.result);
      },
    }),
  });
}
