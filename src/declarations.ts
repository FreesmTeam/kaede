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

/* eslint-disable max-lines */
import type * as TauriOAuth2 from "@fabianlars/tauri-plugin-oauth";
import type * as TauriApi from "@tauri-apps/api";
import type * as TauriClipboard from "@tauri-apps/plugin-clipboard-manager";
import type * as TauriDialog from "@tauri-apps/plugin-dialog";
import type * as TauriFs from "@tauri-apps/plugin-fs";
import type * as TauriHttp from "@tauri-apps/plugin-http";
import type * as TauriNotification from "@tauri-apps/plugin-notification";
import type * as TauriOpener from "@tauri-apps/plugin-opener";
import type * as TauriOs from "@tauri-apps/plugin-os";
import type * as TauriProcess from "@tauri-apps/plugin-process";
import type * as TauriUpload from "@tauri-apps/plugin-upload";
import type DevelopmentMode from "src/lib/development-mode";
import type { App, ComputedRef, ShallowReactive, ShallowRef } from "vue";

import type _Application from "@/constants/application.ts";
import type _ASCIIArt from "@/constants/ascii-art.ts";
import type _Browser from "@/constants/browser.ts";
import type _EventListeners from "@/constants/event-listeners.ts";
import type _FileStructure from "@/constants/file-structure.ts";
import type _Launcher from "@/constants/launcher.ts";
import type _Meta from "@/constants/meta.ts";
import type _Permissions from "@/constants/permissions.ts";
import type _Routes from "@/constants/routes.ts";
import type _RowCollections from "@/constants/row-collections.ts";
import type Auth from "@/lib/auth";
import type Browser from "@/lib/browser";
import type Configs from "@/lib/configs";
import type Errors from "@/lib/errors";
import type ExtensionAPI from "@/lib/extension-api";
import type Extensions from "@/lib/extensions";
import type FileManager from "@/lib/file-manager";
import type General from "@/lib/general";
import type Globals from "@/lib/globals";
import type Hashing from "@/lib/hashing";
import type Hooks from "@/lib/hooks";
import type Initialization from "@/lib/initialization";
import type Instances from "@/lib/instances";
import type Launcher from "@/lib/launcher";
import type Logging from "@/lib/logging";
import type Network from "@/lib/network";
import type Permissions from "@/lib/permissions";
import type Processes from "@/lib/processes";
import type Router from "@/lib/router";
import type Schemas from "@/lib/schemas";
import type Txiki from "@/lib/txiki";
import type Watchers from "@/lib/watchers";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";
import type { RouteType } from "@/types/application/route.type.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";
import type { HookReturnType } from "@/types/extensions/hook-return.type.ts";
import type { PermissionType } from "@/types/extensions/permission.type.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type {
  ArgumentAuthReplacementsType,
  ArgumentReplacementsType,
} from "@/types/launcher/launch/argument-replacements.type.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";
import type { PatchDependencyType } from "@/types/launcher/meta/patch-index.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type {
  SpecificPatchLibraryType,
  SpecificPatchMetaType,
} from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { LogLineType } from "@/types/logging/log-line.type.ts";
import type { TranslationsType } from "@/types/translations/translations.type.ts";

/* Expand the globals with Kaede and Tauri namespaces */
declare global {

  /* This variable is replaced to the source code file name at build time */
  const __PRE_BUNDLED_FILENAME__: string;

  /* Declared in the '@/lib/globals/scopes/declare-window.ts' */
  interface Window {

    /* Tauri internals */
    "__TAURI_INTERNALS__": object;

    /* Tauri exposes these */
    "__TAURI__": typeof TauriApi & {
      "dialog"          : typeof TauriDialog;
      "clipboardManager": typeof TauriClipboard;
      "fs"              : typeof TauriFs;
      "http"            : typeof TauriHttp;
      "notification"    : typeof TauriNotification;
      "opener"          : typeof TauriOpener;
      "os"              : typeof TauriOs;
      "process"         : typeof TauriProcess;
      "upload"          : typeof TauriUpload;
    };

    /* Tauri community plugins */
    "__TAURI_PLUGINS_COMMUNITY__": {
      "oauth2": typeof TauriOAuth2;
    };

    /**
     * Application namespace.
     *
     * Extensions can extend this namespace
     */
    "__KAEDE__": {

      /**
       * Workarounds for application internals.
       *
       * These fields are generally not intended to be modified by extensions
       */
      "internals": {
        // Requests plugin permissions from user
        "requestPermissions"  : (
          permissions: Array<PermissionType | string> | unknown,
          extension: string
        ) => Promise<Array<unknown>>;
        // Platform-specific delimiter
        "joinDelimiter"       : string;
        // Launcher version
        "launcherVersion"     : string;
        // SHA256 of the launcher executable (empty when unavailable)
        "executableHash"      : string;
        // Config state before launcher initialization (used for first sync check)
        "initialConfig"       : ConfigType;
        // Translations state before launcher initialization
        "initialTranslations" : TranslationsType;
        // Instances metadata state before launcher initialization (used for first sync check)
        "initialInstances"    : InstanceStatesType;
        // Portable state
        "portable"            : boolean;
        // Base directory
        "baseDirectory"       : string;
        // This counter starts as 0 and increases by 1 each time the UI is reloaded (window#reload)
        "launchCount"         : number;
        // A Java major version (for example, 8, 11, or 17)
        "javaMajor"          ?: number;

        "appInstance"        ?: App<Element>;
        "logs"               ?: {
          "raw"     : ShallowRef<{ "list": Array<string> }>;
          "filtered": ComputedRef<{ "list": Array<LogLineType> }>;
        };
        "instanceContext"    ?: {
          "launches": Record<string, LauncherStatusesType>;
          "logs"    : ShallowReactive<Record<string, {
            "list": string[];
          }>>;
          "launchInstance": (instanceId?: string) => Promise<void>;
          "closeInstance" : (instanceId: string) => Promise<void>;
        };

        /* Needed for browser environments (non-application) */
        "logsInBrowser"       : Array<string>;
        "indexedDB"          ?: IDBDatabase;
      };

      /**
       * Exposed packages.
       *
       * Used for externalizing plugin dependencies.
       * Contains only Vue 3 as of now.
       */
      "packages": Record<string, unknown>;

      /**
       * Global constants.
       *
       * Changing any field of the listed objects
       * will alter behaviour of that field for everyone.
       *
       * Example:
       *
       * ```ts
       * // Somewhere in a plugin.
       * // This assignment changes the config filename for everyone,
       * // meaning that now the config file will be stored
       * // under 'config.json5' instead of 'config.json'
       * window.__KAEDE__.libs.FileStructure.Files.Config = "config.json5";
       * ```
       */
      "constants": {

        /**
         * Application constants
         */
        "Application": typeof _Application;

        /**
         * Includes a default ASCII art generator
         */
        "ASCIIArt": typeof _ASCIIArt;

        /**
         * Constants related to the 'Browser' lib in 'libs' (non-application)
         */
        "Browser": typeof _Browser;

        /**
         * Event listeners for the sandboxed plugins
         */
        "EventListeners": typeof _EventListeners;

        /**
         * Launcher file structure
         */
        "FileStructure": typeof _FileStructure;

        /**
         * Minecraft launch related constants
         */
        "Launcher": typeof _Launcher;

        /**
         * Launcher meta related constants
         */
        "Meta": typeof _Meta;

        /**
         * Useful objects for the sandboxed permission system
         */
        "Permissions": typeof _Permissions;

        /**
         * Constants related to the application pages
         */
        "Routes": typeof _Routes;

        /**
         * Constants related to the settings rows
         */
        "RowCollections": typeof _RowCollections;
      };

      /**
       * Global utilities.
       *
       * Changing any field of the listed objects
       * will alter behaviour of that field for everyone.
       *
       * Example:
       *
       * ```ts
       * // Somewhere in a plugin
       * const arrayInADifferentScope: Array<unknown> = [];
       *
       * function customDebugFunction(...input: Array<unknown>): void {
       *   arrayInADifferentScope.push(input);
       * };
       *
       * // This assignment overwrites the 'debug' field in the 'log' object
       * // with a reference to the 'customDebugFunction' function,
       * // so all upcoming 'log#debug' calls will use the 'customDebugFunction' function
       * // even if calls were not made via accessing the 'window' object
       * window.__KAEDE__.libs.Logging.log.debug = customDebugFunction;
       * ```
       */
      "libs": {

        /**
         * Launcher account-related collection of utilities
         */
        "Auth": typeof Auth;

        /**
         * A support for the Browser environment (non-application)
         */
        "Browser": typeof Browser;

        /**
         * Launcher configuration-related collection of utilities
         */
        "Configs": typeof Configs;

        /**
         * Launcher development mode related collection of utilities
         */
        "DevelopmentMode": typeof DevelopmentMode;

        /**
         * Launcher errors-related collection of utilities
         */
        "Errors": typeof Errors;

        /**
         * Launcher untrusted extensions API
         */
        "ExtensionAPI": typeof ExtensionAPI;

        /**
         * Launcher extensions-related collection of utilities
         */
        "Extensions": typeof Extensions;

        /**
         * Launcher file management related collection of utilities
         */
        "FileManager": typeof FileManager;

        /**
         * Launcher general-purpose collection of utilities
         */
        "General": typeof General;

        /**
         * Launcher 'window' object related collection of utilities
         */
        "Globals": typeof Globals;

        /**
         * Hashing functions
         */
        "Hashing": typeof Hashing;

        /**
         * Launcher hook system related collection of utilities
         */
        "Hooks": typeof Hooks;

        /**
         * Launcher initialization-related collection of utilities
         */
        "Initialization": typeof Initialization;

        /**
         * Launcher Minecraft instances related collection of utilities
         */
        "Instances": typeof Instances;

        /**
         * Launcher Minecraft-related collection of utilities
         */
        "Launcher": typeof Launcher;

        /**
         * Launcher logging-related collection of utilities
         */
        "Logging": typeof Logging;

        /**
         * Launcher network and fetching related collection of utilities
         */
        "Network": typeof Network;

        /**
         * Launcher extensions-related collection of permission utilities
         */
        "Permissions": typeof Permissions;

        /**
         * Launcher processes and servers related collection of utilities
         */
        "Processes": typeof Processes;

        /**
         * Launcher navigation-related collection of utilities
         */
        "Router": typeof Router;

        /**
         * Launcher collection of typebox validation schemas
         */
        "Schemas": typeof Schemas;

        /**
         * Launcher utils for extensions to conveniently run txiki.js servers
         */
        "Txiki": typeof Txiki;

        /**
         * Launcher watchers for handling various events
         */
        "Watchers": typeof Watchers;

        /**
         * Launcher context menu related collection of utilities
         */
        "ContextMenu": {

          /*
           * Shows context menu. Requires the 'MouseEvent' typed event
           * as the argument, since the context menu dynamically calculates
           * its absolute position in the DOM by reading the provided event
           */
          "show" : (event: MouseEvent) => void;
          // Hides context menu
          "close": () => void;
        };

        /**
         * Launcher pages-related collection of utilities
         */
        "Pages": {
          // Teleports the specified page to an element with the provided selector
          "mount"  : (page: Exclude<RouteType, "none">, id: string) => void;
          // Removes the specified page from DOM
          "unmount": (page: Exclude<RouteType, "none">) => void;
        };
      };

      /**
       * Application hooks
       */
      "hooks": {

        /**
         * Executed on the config retrieve
         */
        "onConfigFileGet": {

          /**
           * Executes 'async' or 'sync' functions before the config was read.
           *
           * @param input - a string that represents absolute pathname of the config file
           *                is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'ConfigType' type
           *                 in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<string, ConfigType>;

          /**
           * Executes 'async' or 'sync' functions after the config was read, parsed, and validated.
           *
           * @param input - an object that has the 'ConfigType' type
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'ConfigType' type
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * it may add properties to the passed config argument or do nothing.
           */
          "after": HookReturnType<ConfigType, ConfigType>;
        };

        /**
         * Executed on the default config retrieve
         */
        "onDefaultConfigGet": {

          /**
           * Executes 'async' or 'sync' functions before the default config was returned.
           *
           * No arguments.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'ConfigType' type
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<unknown, ConfigType>;
        };

        /**
         * Executed in the very beginning of the instance launch
         */
        "onPreLaunchInformation": {

          /**
           * Executes 'sync'-only functions before any information reads.
           *
           * @param input - an object that has the 'statuses' and 'instanceId' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'PreLaunchInformationType | false' type
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            { "statuses": LauncherStatusesType; "instanceId": string },
            PreLaunchInformationType | false,
            "non-promise"
          >;

          /**
           * Executes 'sync'-only functions after all necessary information
           * was read and validated. If the validation fails, these hooks will not fire.
           *
           * @param input - an object that has the 'PreLaunchInformationType | false' type
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'PreLaunchInformationType | false' type
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "after": HookReturnType<
            PreLaunchInformationType | false,
            PreLaunchInformationType | false,
            "non-promise"
          >;
        };

        /**
         * Executed on libraries and natives parsing
         */
        "onLibrariesParsing": {

          /**
           * Executes 'sync'-only functions before any actions.
           *
           * @param input - an object that has the 'necessaries' and 'libraries' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'LibraryArtifactsType' type
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            {
              "necessaries": PreLaunchInformationType;
              "libraries"  : Array<SpecificPatchLibraryType>;
            },
            Array<MappedArtifactType>,
            "non-promise"
          >;

          /**
           * Executes 'sync'-only functions after all libraries and natives are parsed.
           *
           * @param input - an object that has the 'necessaries', 'unparsed',
           * and 'parsed' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'LibraryArtifactsType' type
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "after": HookReturnType<
            {
              "necessaries": PreLaunchInformationType;
              "unparsed"   : Array<SpecificPatchLibraryType>;
              "parsed"     : Array<MappedArtifactType>;
            },
            Array<MappedArtifactType>,
            "non-promise"
          >;
        };

        /**
         * Executed on version meta get
         */
        "onVersionMeta": {

          /**
           * Executes 'async' or 'sync' functions before any actions.
           *
           * @param input - an object that has the 'PreLaunchInformationType' type
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'SpecificPatchMetaType | false' type
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            PreLaunchInformationType,
            SpecificPatchMetaType | false
          >;

          /**
           * Executes 'async' or 'sync' functions after the minecraft version meta
           * was read and validated. If the validation fails, these hooks will not fire.
           *
           * @param input - an object that has the 'necessaries' and 'minecraftVersionMeta' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'SpecificPatchMetaType | false' type
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "after": HookReturnType<
            {
              "necessaries"         : PreLaunchInformationType;
              "minecraftVersionMeta": SpecificPatchMetaType | false;
            },
            SpecificPatchMetaType | false
          >;
        };

        /**
         * Executed on minecraft assets downloading/verifying
         */
        "onMinecraftAssetsGet": {

          /**
           * Executes 'async' or 'sync' functions before any actions.
           *
           * @param input - an object that has the 'necessaries' and 'versionMeta' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - a boolean (where 'true' is success and 'false' is fail)
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            {
              "necessaries": PreLaunchInformationType;
              "versionMeta": SpecificPatchMetaType;
            },
            boolean
          >;

          /**
           * Executes 'async' or 'sync' functions after the minecraft version meta
           * was read and validated. If the validation fails, these hooks will not fire.
           *
           * @param input - an object that has the 'necessaries' and 'versionMeta' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - a boolean (where 'true' is success and 'false' is fail)
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "after": HookReturnType<
            {
              "necessaries": PreLaunchInformationType;
              "versionMeta": SpecificPatchMetaType;
            },
            boolean
          >;
        };

        /**
         * Executed on prism launcher patches downloading/verifying
         */
        "onMinecraftPatchesGet": {

          /**
           * Executes 'async' or 'sync' functions before any actions.
           *
           * @param input - an object that has the 'necessaries' and 'versionMeta' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'LibraryArtifactsType' type
           * or 'false' in case of a fail
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            {
              "necessaries": PreLaunchInformationType;
              "versionMeta": SpecificPatchMetaType;
            },
            Array<MappedArtifactType> | false
          >;

          /**
           * Executes 'async' or 'sync' functions after the prism launcher patches
           * were handled. If the handling fails, these hooks will not fire.
           *
           * @param input - an object that has the 'necessaries', 'results',
           * and 'versionMeta' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'LibraryArtifactsType' type
           * or 'false' in case of a fail
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "after": HookReturnType<
            {
              "necessaries": PreLaunchInformationType;
              "results"    : Array<MappedArtifactType>;
              "versionMeta": SpecificPatchMetaType;
            },
            Array<MappedArtifactType> | false
          >;
        };

        /**
         * Executed on minecraft main jar downloading/verifying
         */
        "onMinecraftClientGet": {

          /**
           * Executes 'async' or 'sync' functions before any actions.
           *
           * @param input - an object that has the 'necessaries', 'client',
           * and 'versionMeta' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - a 'void'
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            {
              "necessaries": PreLaunchInformationType;
              "client"     : MappedArtifactType;
              "versionMeta": SpecificPatchMetaType;
            },
            void
          >;

          /**
           * Executes 'async' or 'sync' functions after the minecraft main jar
           * was downloaded/validated. If the download/validation fails, these hooks will not fire.
           *
           * @param input - an object that has the 'necessaries', 'client',
           * and 'versionMeta' fields
           * is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<
            {
              "necessaries": PreLaunchInformationType;
              "client"     : MappedArtifactType;
              "versionMeta": SpecificPatchMetaType;
            },
            "nothing"
          >;
        };

        /**
         * Executed on minecraft logging downloading/verifying
         */
        "onMinecraftLoggingGet": {

          /**
           * Executes 'async' or 'sync' functions before any actions.
           *
           * @param input - an object that has the 'necessaries', 'logging',
           * and 'versionMeta' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - a 'void'
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            {
              "necessaries": PreLaunchInformationType;
              "logging"    : MappedArtifactType & {
                "argument": string;
              };
              "versionMeta": SpecificPatchMetaType;
            },
            void
          >;

          /**
           * Executes 'async' or 'sync' functions after the minecraft logging config
           * was downloaded/verified. If the download/verification fails, these hooks will not fire.
           *
           * @param input - an object that has the 'necessaries', 'logging',
           * and 'versionMeta' fields
           * is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<
            {
              "necessaries": PreLaunchInformationType;
              "logging"    : MappedArtifactType & {
                "argument": string;
              };
              "versionMeta": SpecificPatchMetaType;
            },
            "nothing"
          >;
        };

        /**
         * Executed on minecraft libraries downloading/verifying
         */
        "onMinecraftLibrariesGet": {

          /**
           * Executes 'async' or 'sync' functions before any actions.
           *
           * @param input - an object that has the 'necessaries', 'libraries',
           * 'natives', and 'versionMeta' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - a 'void'
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            {
              "necessaries": PreLaunchInformationType;
              "libraries"  : Array<MappedArtifactType>;
              "natives"    : Array<MappedArtifactType>;
              "versionMeta": SpecificPatchMetaType;
            },
            void
          >;

          /**
           * Executes 'async' or 'sync' functions after the minecraft libraries were
           * downloaded/verified. If the download/verification fails, these hooks will not fire.
           *
           * @param input - an object that has the 'necessaries', 'libraries',
           * 'natives', and 'versionMeta' fields
           * is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<
            {
              "necessaries": PreLaunchInformationType;
              "libraries"  : Array<MappedArtifactType>;
              "natives"    : Array<MappedArtifactType>;
              "versionMeta": SpecificPatchMetaType;
            },
            "nothing"
          >;
        };

        /**
         * Executed on minecraft natives extraction
         */
        "onNativesExtract": {

          /**
           * Executes 'async' or 'sync' functions before any actions.
           *
           * @param input - an object that has the 'necessaries' and 'paths' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - a 'void'
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            {
              "necessaries": PreLaunchInformationType;
              "paths"      : Array<string>;
            },
            void
          >;

          /**
           * Executes 'async' or 'sync' functions after the minecraft libraries were
           * downloaded/verified. If the download/verification fails, these hooks will not fire.
           *
           * @param input - an object that has the 'necessaries' and 'paths' fields
           * is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<
            {
              "necessaries": PreLaunchInformationType;
              "paths"      : Array<string>;
            },
            "nothing"
          >;
        };

        /**
         * Executed on a shell command name get
         */
        "onJavaBinaryGet": {

          /**
           * Executes 'async' or 'sync' functions before any actions.
           *
           * @param input - an object that has the 'instanceId', 'necessaries',
           * 'versionMeta', and 'parsed' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - a string that represents the shell command name
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            {
              "necessaries": PreLaunchInformationType;
              "versionMeta": SpecificPatchMetaType;
            },
            string
          >;
        };

        /**
         * Executed on JVM arguments get
         */
        "onJVMArgumentsGet": {

          /**
           * Executes 'async' or 'sync' functions before any actions.
           *
           * @param input - an object that has the 'instanceId', 'necessaries',
           * 'versionMeta', 'jvmArguments', and 'parsed' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - a string that represents the JVM arguments
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            {
              "jvmArguments": Array<string>;
              "instanceId"  : string;
              "necessaries" : PreLaunchInformationType;
              "versionMeta" : SpecificPatchMetaType;
              "parsed"      : Array<MappedArtifactType>;
            },
            string
          >;

          /**
           * Executes 'async' or 'sync' functions after the JVM arguments were collected.
           *
           * @param input - an object that has the 'instanceId', 'necessaries',
           * 'versionMeta', and 'parsed' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - a string that represents the JVM arguments
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "after": HookReturnType<
            {
              "jvmArguments": Array<string>;
              "instanceId"  : string;
              "necessaries" : PreLaunchInformationType;
              "versionMeta" : SpecificPatchMetaType;
              "parsed"      : Array<MappedArtifactType>;
            },
            string
          >;
        };

        /**
         * Executed on classpaths get
         */
        "onClassPathsGet": {

          /**
           * Executes 'async' or 'sync' functions right after
           * acquiring merged library, native, and main jar paths.
           *
           * @param input - an object that has the 'instanceId', 'necessaries',
           * 'versionMeta', 'mergedPaths', and 'parsed' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the argument string and classpaths string
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            {
              "mergedPaths": Array<string>;
              "instanceId" : string;
              "necessaries": PreLaunchInformationType;
              "versionMeta": SpecificPatchMetaType;
              "parsed"     : Array<MappedArtifactType>;
            },
            {
              "argument"  : string;
              "classPaths": string;
            }
          >;
        };

        /**
         * Executed on game arguments get
         */
        "onGameArgumentsGet": {

          /**
           * Executes 'async' or 'sync' functions before any actions.
           *
           * @param input - an object that has the 'instanceId', 'necessaries',
           * 'versionMeta', and 'parsed' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - a string that represents the game arguments
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            {
              "instanceId" : string;
              "necessaries": PreLaunchInformationType;
              "versionMeta": SpecificPatchMetaType;
              "parsed"     : Array<MappedArtifactType>;
            },
            string
          >;

          /**
           * Executes 'async' or 'sync' functions after the MultiMC tweakers were added.
           *
           * @param input - an object that has the 'argumentsWithTweakers', 'instanceId',
           * 'necessaries', 'versionMeta', and 'parsed' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - a string that represents the game arguments
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "after": HookReturnType<
            {
              "argumentsWithTweakers": Array<string>;
              "instanceId"           : string;
              "necessaries"          : PreLaunchInformationType;
              "versionMeta"          : SpecificPatchMetaType;
              "parsed"               : Array<MappedArtifactType>;
            },
            string
          >;
        };

        /**
         * Executed on additional start arguments get.
         * For example, '/C javaw' for the 'cmd' command
         */
        "onAdditionalStartArgumentsGet": {

          /**
           * Executes 'async' or 'sync' functions before any actions.
           *
           * @param input - an object that has the 'instanceId', 'necessaries',
           * 'versionMeta', 'javaBinary', and 'parsed' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - a string that represents additional commands before JVM arguments
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            {
              "jvmArguments": Array<string>;
              "instanceId"  : string;
              "necessaries" : PreLaunchInformationType;
              "versionMeta" : SpecificPatchMetaType;
              "parsed"      : Array<MappedArtifactType>;
            },
            string
          >;
        };

        /**
         * Executed on argument placeholders replace in the launch command
         */
        "onLaunchArgumentsReplace": {

          /**
           * Executes 'sync'-only functions before making a regex replacements (no auth)
           *
           * @param input - an object that has the 'auth', 'replacements', 'builtLaunchArguments',
           * 'instanceId', 'necessaries', 'versionMeta', 'parsed', and 'javaBinary' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - a string that represents the final launch command
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            {
              "auth": {
                "username": string;

                /**
                 * Scary!
                 */
                "token": string;
                "uuid" : string;
                "type" : string;
                "xuid" : string;
              };
              "replacements"        : ArgumentReplacementsType;
              "builtLaunchArguments": {
                "toReplace" : string;
                "classPaths": string;
              };
              "instanceId" : string;
              "necessaries": PreLaunchInformationType;
              "versionMeta": SpecificPatchMetaType;
              "parsed"     : Array<MappedArtifactType>;
              "javaBinary" : string;
            },
            string,
            "non-promise"
          >;

          /**
           * Executes 'sync'-only functions before making an auth regex replacements,
           * but after the non-auth regex replacements
           *
           * @param input - an object that has the 'auth', 'authReplacements',
           * 'replacements', 'builtLaunchArguments', 'instanceId',
           * 'necessaries', 'versionMeta', 'parsed', and 'javaBinary' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - a string that represents the final launch command
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "after": HookReturnType<
            {
              "auth": {
                "username": string;

                /**
                 * Scary!
                 */
                "token": string;
                "uuid" : string;
                "type" : string;
                "xuid" : string;
              };
              "replacements"        : ArgumentReplacementsType;
              "authReplacements"    : ArgumentAuthReplacementsType;
              "builtLaunchArguments": {
                "toReplace" : string;
                "classPaths": string;
              };
              "instanceId" : string;
              "necessaries": PreLaunchInformationType;
              "versionMeta": SpecificPatchMetaType;
              "parsed"     : Array<MappedArtifactType>;
              "javaBinary" : string;
            },
            string,
            "non-promise"
          >;
        };

        /**
         * Executed on minecraft instance launch
         */
        "onMinecraftLaunch": {

          /**
           * Executes 'async' or 'sync' functions before any actions.
           *
           * @param input - an object that has the 'command', 'auth',
           * 'builtLaunchArguments', 'instanceId', 'necessaries',
           * 'parsed', 'versionMeta', and 'javaBinary' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - a 'void'
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            {
              // [javaBinary, launchCommand]
              "command": [string, string];
              "auth"   : {
                "username": string;

                /**
                 * Scary!
                 */
                "token": string;
                "uuid" : string;
                "type" : string;
                "xuid" : string;
              };
              "builtLaunchArguments": {
                "toReplace" : string;
                "classPaths": string;
              };
              "instanceId" : string;
              "necessaries": PreLaunchInformationType;
              "versionMeta": SpecificPatchMetaType;
              "parsed"     : Array<MappedArtifactType>;
              "javaBinary" : string;
            },
            void
          >;

          /**
           * Executes 'async' or 'sync' functions after the minecraft instance was launched.
           *
           * @param input - an object that has the 'process', 'command', 'auth',
           * 'builtLaunchArguments', 'instanceId', 'necessaries',
           * 'parsed', 'versionMeta', and 'javaBinary' fields
           * is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<
            {
              "process": {
                "pid"  : number;
                "kill" : () => Promise<void>;
                "write": (data: string | Uint8Array | number[]) => Promise<void>;
              };
              // [javaBinary, launchCommand]
              "command": [string, string];
              "auth"   : {
                "username": string;

                /**
                 * Scary!
                 */
                "token": string;
                "uuid" : string;
                "type" : string;
                "xuid" : string;
              };
              "builtLaunchArguments": {
                "toReplace" : string;
                "classPaths": string;
              };
              "instanceId" : string;
              "necessaries": PreLaunchInformationType;
              "versionMeta": SpecificPatchMetaType;
              "parsed"     : Array<MappedArtifactType>;
              "javaBinary" : string;
            },
            "nothing"
          >;
        };

        /**
         * Executed on minecraft instance kill
         */
        "onMinecraftKill": {

          /**
           * Executes 'async' or 'sync' functions before the instance was killed.
           *
           * @param input - an object that has the 'pid' and 'kill' fields
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - a 'void'
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            {
              "pid" : number;
              "kill": () => Promise<void>;
            },
            void
          >;

          /**
           * Executes 'async' or 'sync' functions after the instance was killed.
           *
           * @param input - an instance process id number
           * is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<
            number,
            "nothing"
          >;
        };

        /**
         * Executed on the 'required' field resolve of a patch
         */
        "onMinecraftPatchResolve": {

          /**
           * Executes 'async' or 'sync' functions before any actions.
           *
           * @param input - an object that has the 'necessaries', 'metadata',
           * and 'patchMeta' fields is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'SpecificPatchMetaType | false' type
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            {
              "necessaries": PreLaunchInformationType;
              "metadata"   : PatchDependencyType;
              // This is the patch that has a 'required' field used as 'metadata' above this line
              "patchMeta" ?: SpecificPatchMetaType;
            },
            SpecificPatchMetaType | false
          >;

          /**
           * Executes 'async' or 'sync' functions after resolving and validating the patch.
           * The passed as 'validPatch' patch may be invalid, so check if it is false
           * before doing anything with it.
           *
           * @param input - an object that has the 'necessaries', 'metadata', 'validPatch',
           * and 'patchMeta' fields is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return:
           * @param output - an object that has the 'SpecificPatchMetaType | false' type
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "after": HookReturnType<
            {
              "necessaries": PreLaunchInformationType;
              "metadata"   : PatchDependencyType;
              // A resolved patch
              "validPatch" : SpecificPatchMetaType | false;
              // This is the patch that has a 'required' field used as 'metadata' above this line
              "patchMeta" ?: SpecificPatchMetaType;
            },
            SpecificPatchMetaType | false
          >;
        };
      };
    };
  }
}

/* Export the Kaede namespace type */
export type KaedeNamespaceType = Window["__KAEDE__"];
