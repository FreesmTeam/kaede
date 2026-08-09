<script setup lang="ts">
import {
  inject,
  markRaw,
  provide,
  reactive,
  type ShallowReactive,
  shallowReactive,
  shallowRef,
} from "vue";

import {
  AuthOneTimeFetchContextKey,
  AuthStatesContextKey,
  CloseInstanceContextKey,
  InstanceLogsContextKey,
  LaunchInstanceContextKey,
  LaunchStatesContextKey,
} from "@/constants/application.ts";
import { GeneralSettings, LaunchStatus } from "@/constants/launcher.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import Auth from "@/lib/auth";
import Errors from "@/lib/errors";
import Hooks from "@/lib/hooks";
import Instances from "@/lib/instances";
import Launcher from "@/lib/launcher";
import { log } from "@/lib/logging/log.ts";
import { rehydrateProcesses } from "@/lib/processes/core.ts";
import Watchers from "@/lib/watchers";
import { globalStates } from "@/states/global.ts";
import type { LaunchAuthType } from "@/types/auth/microsoft-auth.type.ts";
import type { AccountType, WrappedAccountsType } from "@/types/configs/account.type.ts";
import type {
  LaunchResponseType,
  MinecraftMetaType,
  MinecraftProcessType,
} from "@/types/launcher/launch/launch-response.type.ts";
import type {
  LauncherStatusesType,
  WrappedInstanceLauncherStatusesType,
} from "@/types/launcher/launch/launch-status.type.ts";
import type { CurrentInstanceType } from "@/types/launcher/meta/current-instance.type.ts";

/**
 * HMR breaks 'fetchAccounts'
 */
const fetchAccounts = inject<() => Array<AccountType>>(AuthOneTimeFetchContextKey)
  ?? ((): Array<AccountType> => []);

const accounts = shallowRef<Array<AccountType>>(fetchAccounts());
const launches = reactive<Record<string, LauncherStatusesType>>({});
const logs = shallowReactive<Record<string, { "list": Array<string> }>>({});

const childProcesses: Record<string, MinecraftProcessType> = {};

function onClose(instanceId: string): void {
  const statuses: LauncherStatusesType | undefined = launches[instanceId];

  // A closed process must not be killable/writable anymore
  delete childProcesses[instanceId];

  if (!statuses) {
    return;
  }

  statuses.launching = 0;
  statuses.current = LaunchStatus.General.Aborted;

  // Open instance logs since the instance was closed
  globalStates.logs.show = true;
  globalStates.logs.mode = instanceId;
}

function createLogSink(instanceId: string): (lines: Array<string>) => void {
  const stored: Array<string> = [];

  // Overwrite the previous launch logs
  logs[instanceId] = { "list": stored };

  const lineLimit: number = GeneralSettings.Logs.LineLimit;

  return (lines: Array<string>): void => {
    if (logs[instanceId]?.list !== stored) {
      return;
    }

    for (const line of lines) {
      stored.push(line);
    }

    // Keeps the newest half of logs
    if (stored.length > lineLimit) {
      stored.splice(0, stored.length - Math.ceil(lineLimit / 2));
    }

    logs[instanceId] = { "list": stored };
  };
}

async function resolveLaunchAccount(): Promise<LaunchAuthType | undefined> {
  const resolved: {
    "auth"    : LaunchAuthType;
    "accounts": Array<AccountType>;
  } | undefined = await Auth.resolveLaunchAccount(accounts.value);

  if (resolved === undefined) {
    return undefined;
  }

  accounts.value = resolved.accounts;

  return resolved.auth;
}

const getJavaMajor = async (): Promise<number> => {
  if (GlobalInternals.javaMajor) {
    return GlobalInternals.javaMajor;
  }

  return Launcher.fetchJavaMajor();
};

async function launchInstance(instanceId?: string): Promise<void> {
  if (!instanceId) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "The instance launch button was pressed but no instance is present",
    );

    return;
  }

  const currentInstance: CurrentInstanceType = Instances.findCurrent(instanceId);

  if (!currentInstance || !currentInstance.instance) {
    log.error(__PRE_BUNDLED_FILENAME__, "No current instance found");

    return;
  }

  launches[instanceId] = {
    instanceId,
    "launching": 1,
    "current"  : undefined,
    "downloads": {
      "current": markRaw(new Map<string, [number, number]>),
      "success": 0,
      "failed" : 0,
      "total"  : 0,
    },
  };

  const statuses: LauncherStatusesType = launches[instanceId];
  const startTime: number = performance.now();

  statuses.current = LaunchStatus.General.Starting;

  try {
    const onInput = createLogSink(instanceId);

    const [javaMajor, account]: [number, LaunchAuthType | undefined] =
      await Promise.all([getJavaMajor(), resolveLaunchAccount()]);

    const { success, process }: LaunchResponseType = await Launcher.handleLaunch({
      "instance"       : currentInstance.instance,
      "userPreferences": {
        "javaBinary": currentInstance.instance.javaBinary,
        "javaMajor" : javaMajor,
        "versions"  : currentInstance.instance.patchVersions,
        account,
      },
      instanceId,
      statuses,
      onClose,
      onInput,
    });

    statuses.launching = success ? 2 : 0;

    if (process !== undefined) {
      childProcesses[instanceId] = process;
    }
  } catch (error: unknown) {
    statuses.launching = 0;
    statuses.current = LaunchStatus.Errors.UnhandledError;

    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Unhandled error.",
      `Could not launch the '${instanceId}' instance:`,
      Errors.prettify(error),
    );
  }

  const endTime: number = performance.now();
  const totalTime: string = (endTime - startTime).toFixed(2);

  log.info(
    __PRE_BUNDLED_FILENAME__,
    `The '${instanceId}' launch process was done in ${totalTime} ms.`,
    `Is success: '${statuses.launching === 2}'`,
  );
}

async function closeInstance(instanceId: string): Promise<void> {
  const process: MinecraftProcessType | undefined = childProcesses[instanceId];

  if (!process) {
    return log.error(
      __PRE_BUNDLED_FILENAME__,
      `The '${instanceId}' instance kill action was called but no process is present`,
    );
  }

  const beforeHooksResult: "continue" | void | undefined =
    await Hooks.catchAsyncResponseHooks<void>({
      "scope" : "onMinecraftKill",
      "toPass": process,
      "timing": "before",
    });

  if (beforeHooksResult !== "continue") {
    return;
  }

  try {
    await process.kill();
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      `Could not kill the '${instanceId}' instance:`,
      Errors.prettify(error),
    );
  }
}

async function rehydrateLaunchedInstances(): Promise<void> {
  try {
    /*
     * 'watchProcesses' that is run in 'main.ts' might still be in a Promise state,
     * so we ensure it is awaited here
     */
    await Watchers.watchProcesses();

    const handles = await rehydrateProcesses(handle => {
      if (handle.kind !== "minecraft") {
        return;
      }

      const { instanceId } = handle.meta as MinecraftMetaType;

      launches[instanceId] = {
        instanceId,
        "launching": 2,
        "current"  : LaunchStatus.General.Success,
        "downloads": {
          "current": markRaw(new Map<string, [number, number]>),
          "success": 0,
          "failed" : 0,
          "total"  : 0,
        },
      };

      return {
        "onOutput": createLogSink(instanceId),
        "onExit"  : (payload): void => {
          onClose(instanceId);
          Hooks.catchAsyncVoidHooks({
            "scope" : "onMinecraftKill",
            "toPass": payload.pid,
            "timing": "after",
          });
        },
      };
    });

    let count: number = 0;

    for (const handle of handles) {
      if (handle.kind !== "minecraft") {
        continue;
      }

      const _handle = handle as MinecraftProcessType;

      childProcesses[_handle.meta.instanceId] = _handle;
      count += 1;
    }

    if (count > 0) {
      log.info(
        __PRE_BUNDLED_FILENAME__,
        `Rehydrated ${count} still-running instance(s) after a reload`,
      );
    }
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Failed to rehydrate launched instances:",
      Errors.prettify(error),
    );
  }
}

void rehydrateLaunchedInstances();

/*
 * AFAIK, even unrestricted extensions should not be able to access this context
 * although they can still just read the 'accounts.json' file
 * or do whatever else they want to do in the system.
 *
 * UPD: with the new capability of Vue instance sharing and using our own component registry,
 * the extensions can simply replace something like 'C.Tabs' to their own
 * component that also tries to inject 'AuthStatesContextKey', which should succeed
 * and provide them a valid array of accounts. Scary? Well, use trusted or sandboxed
 * extensions in such case. Unrestricted untrusted extensions can do way more harm
 * to your system in contrast to simply stealing your Minecraft tokens.
 */
provide<WrappedAccountsType>(AuthStatesContextKey, accounts);

/*
 * Provide multiple instance launch statuses
 */
provide<WrappedInstanceLauncherStatusesType>(LaunchStatesContextKey, launches);

provide<ShallowReactive<Record<string, { "list": Array<string> }>>>(InstanceLogsContextKey, logs);
provide<(instanceId?: string) => Promise<void>>(LaunchInstanceContextKey, launchInstance);
provide<(instanceId: string) => Promise<void>>(CloseInstanceContextKey, closeInstance);

GlobalInternals.instanceContext = { launches, logs, launchInstance, closeInstance };

Watchers.watchLogModeStates(logs);
</script>

<template>
  <slot />
</template>
