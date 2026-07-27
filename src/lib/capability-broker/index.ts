import { CapabilityBrokerNotInitializedError } from "@/lib/capability-broker/errors.ts";
import type {
  BrokerDecisionStore,
  CapabilityBrokerRuntime,
  DirectHostFacade,
  HostDownloads,
  HostFacade,
  PluginCapabilitySession,
  PluginEventCapabilityFactory,
  PreparedPermissionRequest,
} from "@/lib/capability-broker/types.ts";
import type { PluginPrincipal } from "@/lib/extensions-manager/scopes/principal.ts";
import type { PermissionRequest } from "@/types/extensions/permission.type.ts";

type DownloadToFileInput = Parameters<HostDownloads["toFile"]>[0];
type DownloadProgressHandler = Parameters<HostDownloads["toFile"]>[1];
type DownloadBatchInput = Parameters<HostDownloads["batch"]>[0];
type DownloadBatchProgressHandler = Parameters<HostDownloads["batch"]>[1];

export type {
  BrokerDecisionStore,
  BrokerProcess,
  BrokerServerProcess,
  DirectoryEntry,
  DirectHostFacade,
  DownloadBatchSnapshot,
  DownloadReport,
  HostFacade,
  InstalledExtensionsReadResult,
  PermissionTargetIdentity,
  PermissionTargetKind,
  PreparedPermissionRequest,
  PluginCapabilitySession,
  PluginEventCapabilityFactory,
  ProcessEvent,
  ProcessHandle,
  RuntimeSnapshot,
} from "@/lib/capability-broker/types.ts";
export type {
  InitializationFinalizationReport,
} from "@/types/application/initial-state.type.ts";

let activeRuntime: CapabilityBrokerRuntime | undefined;
let eventCapabilityFactory: PluginEventCapabilityFactory | undefined;

function requireRuntime(): CapabilityBrokerRuntime {
  if (activeRuntime === undefined) {
    throw new CapabilityBrokerNotInitializedError;
  }

  return activeRuntime;
}

function getConfiguredEventCapabilityFactory(): PluginEventCapabilityFactory | undefined {
  return eventCapabilityFactory;
}

export async function initializeCapabilityBroker(
  options: Readonly<{ "browserPreview": boolean }>,
): Promise<void> {
  if (activeRuntime !== undefined) {
    return;
  }

  activeRuntime = options.browserPreview
    ? await import("@/lib/browser/scopes/create-browser-capability-broker.ts")
      .then(module => module.createBrowserCapabilityBroker(getConfiguredEventCapabilityFactory))
    : await import("@/lib/capability-broker/desktop-adapter.ts")
      .then(module => module.createDesktopCapabilityBroker(getConfiguredEventCapabilityFactory));
}

export function configurePluginEventCapabilityFactory(
  factory: PluginEventCapabilityFactory,
): void {
  eventCapabilityFactory = factory;
}

export const Host: HostFacade = Object.freeze({
  "diagnostics": Object.freeze({
    "getSystemMemory"  : () => requireRuntime().host.diagnostics.getSystemMemory(),
    "getGlobalCpuUsage": () => requireRuntime().host.diagnostics.getGlobalCpuUsage(),
  }),
  "hashes": Object.freeze({
    "md5"   : bytes => requireRuntime().host.hashes.md5(bytes),
    "sha256": bytes => requireRuntime().host.hashes.sha256(bytes),
  }),
  "runtime": Object.freeze({
    "getSnapshot"           : () => requireRuntime().host.runtime.getSnapshot(),
    "getCachedSnapshot"     : () => requireRuntime().host.runtime.getCachedSnapshot(),
    "getInitialState"       : () => requireRuntime().host.runtime.getInitialState(),
    "finalizeInitialization": input => {
      return requireRuntime().host.runtime.finalizeInitialization(input);
    },
  }),
  "files": Object.freeze({
    "exists"           : path => requireRuntime().host.files.exists(path),
    "existsMany"       : paths => requireRuntime().host.files.existsMany(paths),
    "getMetadata"      : path => requireRuntime().host.files.getMetadata(path),
    "findMissing"      : paths => requireRuntime().host.files.findMissing(paths),
    "verifySha1"       : artifacts => requireRuntime().host.files.verifySha1(artifacts),
    "readDirectory"    : path => requireRuntime().host.files.readDirectory(path),
    "readText"         : path => requireRuntime().host.files.readText(path),
    "readBytes"        : path => requireRuntime().host.files.readBytes(path),
    "writeText"        : (path, contents) => requireRuntime().host.files.writeText(path, contents),
    "rename"           : input => requireRuntime().host.files.rename(input),
    "ensureDirectories": (paths, options) => {
      return requireRuntime().host.files.ensureDirectories(paths, options);
    },
  }),
  "assets": Object.freeze({
    "pickAndCopyInstanceIcon": input => {
      return requireRuntime().host.assets.pickAndCopyInstanceIcon(input);
    },
  }),
  "archives": Object.freeze({
    "extractZip": input => requireRuntime().host.archives.extractZip(input),
  }),
  "extensions": Object.freeze({
    "readInstalledArchives": () => requireRuntime().host.extensions.readInstalledArchives(),
  }),
  "http": Object.freeze({
    "fetch": (input, init) => requireRuntime().host.http.fetch(input, init),
  }),
  "downloads": Object.freeze({
    "toFile": (
      input: DownloadToFileInput,
      onProgress: DownloadProgressHandler,
    ): ReturnType<HostDownloads["toFile"]> => {
      return requireRuntime().host.downloads.toFile(input, onProgress);
    },
    "batch": (
      input: DownloadBatchInput,
      onProgress: DownloadBatchProgressHandler,
    ): ReturnType<HostDownloads["batch"]> => {
      return requireRuntime().host.downloads.batch(input, onProgress);
    },
    "cancel": (cancelId: string) => requireRuntime().host.downloads.cancel(cancelId),
  } satisfies HostFacade["downloads"]),
  "dialogs": Object.freeze({
    "message": input => requireRuntime().host.dialogs.message(input),
    "ask"    : input => requireRuntime().host.dialogs.ask(input),
  }),
  "opener": Object.freeze({
    "revealItem": path => requireRuntime().host.opener.revealItem(path),
  }),
  "processes": Object.freeze({
    "probeJavaMajor" : () => requireRuntime().host.processes.probeJavaMajor(),
    "launchMinecraft": (input, onEvent) => {
      return requireRuntime().host.processes.launchMinecraft(input, onEvent);
    },
    "kill": handle => requireRuntime().host.processes.kill(handle),
  }),
  "servers": Object.freeze({
    "serveCode": (input, onEvent) => requireRuntime().host.servers.serveCode(input, onEvent),
    "serveFile": (input, onEvent) => requireRuntime().host.servers.serveFile(input, onEvent),
  }),
  "logs": Object.freeze({
    "write": input => requireRuntime().host.logs.write(input),
  }),
} satisfies HostFacade);

export const DirectHost: DirectHostFacade = Object.freeze({
  "app": Object.freeze({
    "name"        : () => requireRuntime().direct.app.name(),
    "version"     : () => requireRuntime().direct.app.version(),
    "tauriVersion": () => requireRuntime().direct.app.tauriVersion(),
  }),
  "path": Object.freeze({
    "join"     : (...parts) => requireRuntime().direct.path.join(...parts),
    "normalize": path => requireRuntime().direct.path.normalize(path),
  }),
  "showMainWebview": () => requireRuntime().direct.showMainWebview(),
} satisfies DirectHostFacade);

export const brokerDecisionStore: BrokerDecisionStore = Object.freeze({
  "load": key => requireRuntime().decisionStore.load(key),
  "save": (key, decision) => requireRuntime().decisionStore.save(key, decision),
} satisfies BrokerDecisionStore);

export function preparePermissionRequests(
  requests: ReadonlyArray<PermissionRequest>,
): Promise<ReadonlyArray<PreparedPermissionRequest>> {
  return requireRuntime().preparePermissionRequests(requests);
}

export function openPluginSession(
  principal: PluginPrincipal,
): Promise<PluginCapabilitySession> {
  return requireRuntime().openPluginSession(principal);
}
