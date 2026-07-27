import {
  AuthStatesContextKey,
  CloseInstanceContextKey,
  InstanceLogsContextKey,
  LaunchInstanceContextKey,
  LaunchStatesContextKey,
  TranslationsContextKey,
} from "@/constants/application/context-keys.ts";
import { ContextMenuItems } from "@/constants/application/context-menu.ts";
import { DefaultGlobalStatesPagesStates } from "@/constants/application/page-states.ts";
import {
  InstanceCreationSections,
  SettingsSections,
} from "@/constants/application/sections.ts";
import {
  ApplicationName as _ApplicationName,
  AsyncFunction as _AsyncFunction,
  DefaultLocale,
} from "@/constants/application-primitives.ts";

export const ApplicationRootID = "#app";
export { ApplicationName, AsyncFunction } from "@/constants/application-primitives.ts";
export {
  AuthStatesContextKey,
  CloseInstanceContextKey,
  InstanceLogsContextKey,
  LaunchInstanceContextKey,
  LaunchStatesContextKey,
  TranslationsContextKey,
} from "@/constants/application/context-keys.ts";
export { ContextMenuItems } from "@/constants/application/context-menu.ts";
export { DefaultGlobalStatesPagesStates } from "@/constants/application/page-states.ts";
export { InstanceCreationSections, SettingsSections } from "@/constants/application/sections.ts";

export const CSSThemeExtensions = {
  "Enabled" : ".css",
  "Disabled": ".css.disabled",
} as const;

export default {
  "AsyncFunction"  : _AsyncFunction,
  "ApplicationName": _ApplicationName,
  ApplicationRootID,
  DefaultLocale,
  TranslationsContextKey,
  AuthStatesContextKey,
  LaunchStatesContextKey,
  InstanceLogsContextKey,
  LaunchInstanceContextKey,
  CloseInstanceContextKey,
  CSSThemeExtensions,
  DefaultGlobalStatesPagesStates,
  InstanceCreationSections,
  SettingsSections,
  ContextMenuItems,
} as const;
