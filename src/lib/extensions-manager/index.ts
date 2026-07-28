import { GlobalObject } from "@/extendable/global-object.ts";
import {
  brokerDecisionStore,
  configurePluginEventCapabilityFactory,
  DirectHost,
  Host,
  openPluginSession,
  preparePermissionRequests,
} from "@/lib/capability-broker";
import Errors from "@/lib/errors";
import {
  onGlobalStateChange,
} from "@/lib/extensions-manager/scopes/events/on-global-state-change.ts";
import {
  onInstanceStateChange,
} from "@/lib/extensions-manager/scopes/events/on-instance-state-change.ts";
import {
  createTrustedExtensionContext,
  ExtensionLifecycleController,
} from "@/lib/extensions-manager/scopes/extension-lifecycle.ts";
import {
  createEventSubscribeCapability,
  revokeEventListeners,
} from "@/lib/extensions-manager/scopes/grant-event-listeners.ts";
import { handleCssTheme } from "@/lib/extensions-manager/scopes/handle-css-theme.ts";
import { handleEvent } from "@/lib/extensions-manager/scopes/handle-event.ts";
import {
  catchAsyncResponseHooks,
} from "@/lib/extensions-manager/scopes/hooks/catch-async-response-hooks.ts";
import {
  catchAsyncVoidHooks,
} from "@/lib/extensions-manager/scopes/hooks/catch-async-void-hooks.ts";
import {
  catchSyncResponseHooks,
} from "@/lib/extensions-manager/scopes/hooks/catch-sync-response-hooks.ts";
import { catchSyncVoidHooks } from "@/lib/extensions-manager/scopes/hooks/catch-sync-void-hooks.ts";
import { handleHookResponse } from "@/lib/extensions-manager/scopes/hooks/handle-hook-response.ts";
import { lockdownEnvironment } from "@/lib/extensions-manager/scopes/lockdown-environment.ts";
import {
  configurePermissionDecisionStore,
  permissionPromptController,
} from "@/lib/extensions-manager/scopes/permission-prompts.ts";
import { planPlugins } from "@/lib/extensions-manager/scopes/plugin-planner.ts";
import { readAllExtensions } from "@/lib/extensions-manager/scopes/read-all-extensions.ts";
import { readAllMetadata } from "@/lib/extensions-manager/scopes/read-all-metadata.ts";
import { runInSandbox } from "@/lib/extensions-manager/scopes/run-in-sandbox.ts";
import { runInUnrestricted } from "@/lib/extensions-manager/scopes/run-in-unrestricted.ts";
import { createSandboxRuntime } from "@/lib/extensions-manager/scopes/sandbox-runtime.ts";
import { showWebviewWindow } from "@/lib/extensions-manager/scopes/show-webview-window.ts";
import { log } from "@/lib/logging/scopes/log.ts";

const extensionLifecycleState: {
  "controller"?: ExtensionLifecycleController;
} = {};

function createExtensionLifecycleController({
  revokeExtensionGlobals,
}: Readonly<{
  "revokeExtensionGlobals": () => void;
}>): ExtensionLifecycleController {
  extensionLifecycleState.controller ??= new ExtensionLifecycleController({
    readAllExtensions,
    readAllMetadata,
    planPlugins,
    "configurePermissionDecisions": (): void => {
      configurePermissionDecisionStore(brokerDecisionStore);
    },
    "configureEventCapabilities": (): void => {
      configurePluginEventCapabilityFactory(createEventSubscribeCapability);
    },
    "trustedContext": createTrustedExtensionContext({
      Host,
      DirectHost,
      "Kaede": GlobalObject,
    }),
    runInUnrestricted,
    revokeExtensionGlobals,
    lockdownEnvironment,
    preparePermissionRequests,
    "requestStaticPermissions": (principal, requests): Promise<boolean> => {
      return permissionPromptController.requestStatic(principal, requests);
    },
    "requestDynamicPermissions": (principal, requests): Promise<ReadonlyArray<boolean>> => {
      return permissionPromptController.requestDynamic(principal, requests);
    },
    "cancelPermissionPrompts": (principal): void => {
      permissionPromptController.cancelAll(principal);
    },
    openPluginSession,
    createSandboxRuntime,
    runInSandbox,
    revokeEventListeners,
    "reportError": (context, error): void => {
      log.error(__PRE_BUNDLED_FILENAME__, `${context}:`, Errors.prettify(error));
    },
  });

  return extensionLifecycleState.controller;
}

export default {
  catchAsyncResponseHooks,
  catchAsyncVoidHooks,
  catchSyncResponseHooks,
  catchSyncVoidHooks,
  createExtensionLifecycleController,
  onGlobalStateChange,
  onInstanceStateChange,
  handleCssTheme,
  handleEvent,
  handleHookResponse,
  lockdownEnvironment,
  readAllExtensions,
  readAllMetadata,
  runInSandbox,
  runInUnrestricted,
  showWebviewWindow,
} as const;
