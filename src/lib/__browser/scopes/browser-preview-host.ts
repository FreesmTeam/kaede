import {
  createBrowserDownloads,
} from "@/lib/browser/scopes/browser-preview-downloads.ts";
import {
  logInBrowser,
  pickBrowserIcon,
} from "@/lib/browser/scopes/browser-preview-io.ts";
import {
  cloneStorageValue,
  joinBrowserPath,
  normalizeBrowserPath,
  readBrowserDirectory,
  readRequiredValue,
  storageExists,
  storageValueToBytes,
} from "@/lib/browser/scopes/browser-preview-paths.ts";
import type { BrowserStorage } from "@/lib/browser/scopes/browser-storage.ts";
import { UnsupportedInBrowserPreviewError } from "@/lib/capability-broker/errors.ts";
import { validateHostHttpFetchArguments } from "@/lib/capability-broker/host-http-request.ts";
import {
  type DirectHostFacade,
  type DirectoryEntry,
  type HostFacade,
  type HostHttpRequestInit,
  type PickedIcon,
  type RuntimeSnapshot,
} from "@/lib/capability-broker/types.ts";

type VerifySha1Input = Parameters<HostFacade["files"]["verifySha1"]>[0];
type RenameInput = Parameters<HostFacade["files"]["rename"]>[0];
type PickIconInput = Parameters<HostFacade["assets"]["pickAndCopyInstanceIcon"]>[0];
type DialogMessageInput = Parameters<HostFacade["dialogs"]["message"]>[0];
type DialogAskInput = Parameters<HostFacade["dialogs"]["ask"]>[0];
type LogInput = Parameters<HostFacade["logs"]["write"]>[0];

function credentiallessRequestInit(init: HostHttpRequestInit | undefined): RequestInit {
  const requestInit: RequestInit = {
    ...init,
    "credentials": "omit",
  };

  Object.setPrototypeOf(requestInit, null);

  return Object.freeze(requestInit);
}

export function createBrowserHostFacade(
  storage: BrowserStorage,
  runtimeSnapshot: RuntimeSnapshot,
  directHost: DirectHostFacade,
): HostFacade {
  return Object.freeze({
    "diagnostics": Object.freeze({
      "getSystemMemory": async (): Promise<never> => {
        throw new UnsupportedInBrowserPreviewError("system memory diagnostics");
      },
      "getGlobalCpuUsage": async (): Promise<never> => {
        throw new UnsupportedInBrowserPreviewError("global CPU diagnostics");
      },
    }),
    "runtime": Object.freeze({
      "getSnapshot"      : async (): Promise<RuntimeSnapshot> => runtimeSnapshot,
      "getCachedSnapshot": (): RuntimeSnapshot => runtimeSnapshot,
      "getInitialState"  : async () => {
        const placeholder = "buh";
        const joined = await directHost.path.join(placeholder, placeholder);
        const separator = joined.slice(placeholder.length, -1 * placeholder.length);
        const missing = (): Readonly<{ "status": "missing" }> => {
          return Object.freeze({ "status": "missing" });
        };

        return Object.freeze({
          "basic": Object.freeze({
            "launcherVersion": await directHost.app.version(),
            "baseDirectory"  : runtimeSnapshot.baseDirectory,
            "launchCount"    : runtimeSnapshot.launchCount,
            separator,
            "portable"       : runtimeSnapshot.portable,
          }),
          "parsed": Object.freeze({
            "config"      : missing(),
            "accounts"    : missing(),
            "instances"   : missing(),
            "translations": missing(),
          }),
        });
      },
      "finalizeInitialization": async (): Promise<never> => {
        throw new UnsupportedInBrowserPreviewError("native initialization finalization");
      },
    }),
    "files": Object.freeze({
      "exists"    : (path: string): Promise<boolean> => storageExists(storage, path),
      "existsMany": async (
        paths: ReadonlyArray<string>,
      ): Promise<ReadonlyArray<boolean>> => {
        return Object.freeze(await Promise.all(
          paths.map(path => storageExists(storage, path)),
        ));
      },
      "getMetadata": async () => Object.freeze({ "modifiedTimeMilliseconds": null }),
      "findMissing": async (
        paths: ReadonlyArray<string>,
      ): Promise<ReadonlyArray<string>> => {
        const states = await Promise.all(paths.map(path => storageExists(storage, path)));

        return Object.freeze(paths.filter((_path, index) => states[index] !== true));
      },
      "verifySha1": async (artifacts: VerifySha1Input): Promise<ReadonlyArray<string>> => {
        const states = await Promise.all(
          artifacts.map(({ path }) => storageExists(storage, path)),
        );

        return Object.freeze(
          artifacts.filter((_artifact, index) => states[index] !== true).map(({ path }) => path),
        );
      },
      "readDirectory": (
        path: string,
      ): Promise<ReadonlyArray<DirectoryEntry>> => readBrowserDirectory(storage, path),
      "readText": async (path: string): Promise<string> => {
        const value = await readRequiredValue(storage, path);

        return typeof value === "string" ? value : (new TextDecoder).decode(value);
      },
      "readBytes": async (path: string): Promise<Uint8Array> => {
        return storageValueToBytes(await readRequiredValue(storage, path));
      },
      "writeText": async (path: string, contents: string): Promise<void> => {
        await storage.write(normalizeBrowserPath(path), contents);
      },
      "rename": async ({ from, to }: RenameInput): Promise<void> => {
        const value = await readRequiredValue(storage, from);

        await storage.write(normalizeBrowserPath(to), cloneStorageValue(value));
        await storage.remove(normalizeBrowserPath(from));
      },
      "ensureDirectories": async (): Promise<void> => {},
    }),
    "assets": Object.freeze({
      "pickAndCopyInstanceIcon": async (
        input: PickIconInput,
      ): Promise<PickedIcon | null> => {
        const file = await pickBrowserIcon(input.allowedExtensions);

        if (file === null) {
          return null;
        }

        const path = joinBrowserPath(input.destinationDirectory, file.name);
        const bytes = new Uint8Array(await file.arrayBuffer());

        await storage.write(path, bytes);

        return Object.freeze({ path, bytes });
      },
    }),
    "archives": Object.freeze({
      "extractZip": async (): Promise<never> => {
        throw new UnsupportedInBrowserPreviewError("ZIP extraction");
      },
    }),
    "extensions": Object.freeze({
      "readInstalledArchives": async () => Object.freeze({
        "extensions": Object.freeze([]),
        "failures"  : Object.freeze([]),
      }),
    }),
    "http": Object.freeze({
      "fetch": async (input: string | URL, init?: HostHttpRequestInit): Promise<Response> => {
        const validatedInit = validateHostHttpFetchArguments(input, init);

        return fetch(input, credentiallessRequestInit(validatedInit));
      },
    }),
    "downloads": createBrowserDownloads(storage),
    "dialogs"  : Object.freeze({
      "message": async (input: DialogMessageInput): Promise<void> => {
        alert(`${input.title} (${input.kind})\n\n${input.message}`);
      },
      "ask": async (input: DialogAskInput): Promise<boolean> => {
        return confirm(`${input.title} (${input.kind})\n\n${input.message}`);
      },
    }),
    "opener": Object.freeze({
      "revealItem": async (path: string): Promise<void> => {
        const location = normalizeBrowserPath(path).split("/")
          .slice(0, -1)
          .join("/");
        const entries = await readBrowserDirectory(storage, location);
        const contents = entries.map(entry => `- ${entry.name}`).join("\n");

        alert(`Directory (${location})\n\n${contents}`);
      },
    }),
    "processes": Object.freeze({
      "probeJavaMajor": async (): Promise<never> => {
        throw new UnsupportedInBrowserPreviewError("Java probing");
      },
      "launchMinecraft": async (): Promise<never> => {
        throw new UnsupportedInBrowserPreviewError("Minecraft process launch");
      },
      "kill": async (): Promise<never> => {
        throw new UnsupportedInBrowserPreviewError("process control");
      },
    }),
    "servers": Object.freeze({
      "serveCode": async (): Promise<never> => {
        throw new UnsupportedInBrowserPreviewError("txiki server process launch");
      },
      "serveFile": async (): Promise<never> => {
        throw new UnsupportedInBrowserPreviewError("txiki server process launch");
      },
    }),
    "logs": Object.freeze({
      "write": (input: LogInput): void => {
        logInBrowser(input.level, input.message, input.location);
      },
    }),
  } satisfies HostFacade);
}
