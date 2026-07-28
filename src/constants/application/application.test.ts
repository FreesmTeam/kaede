import { describe, expect, it } from "vitest";

import Application, {
  ApplicationName,
  ApplicationRootID,
  AsyncFunction,
  AuthStatesContextKey,
  CloseInstanceContextKey,
  ContextMenuItems,
  CSSThemeExtensions,
  DefaultGlobalStatesPagesStates,
  InstanceCreationSections,
  InstanceLogsContextKey,
  LaunchInstanceContextKey,
  LaunchStatesContextKey,
  SettingsSections,
  TranslationsContextKey,
} from "@/constants/application.ts";
import { DefaultLocale } from "@/constants/application-primitives.ts";

describe("application constants facade", () => {
  it("preserves the plugin-facing default export", () => {
    expect(Object.keys(Application)).toStrictEqual([
      "AsyncFunction",
      "ApplicationName",
      "ApplicationRootID",
      "DefaultLocale",
      "TranslationsContextKey",
      "AuthStatesContextKey",
      "LaunchStatesContextKey",
      "InstanceLogsContextKey",
      "LaunchInstanceContextKey",
      "CloseInstanceContextKey",
      "CSSThemeExtensions",
      "DefaultGlobalStatesPagesStates",
      "InstanceCreationSections",
      "SettingsSections",
      "ContextMenuItems",
    ]);
    expect(Application.AsyncFunction).toBe(AsyncFunction);
    expect(Application.ApplicationName).toBe(ApplicationName);
    expect(Application.ApplicationRootID).toBe(ApplicationRootID);
    expect(Application.DefaultLocale).toBe(DefaultLocale);
    expect(Application.CSSThemeExtensions).toBe(CSSThemeExtensions);
    expect(Application.DefaultGlobalStatesPagesStates).toBe(DefaultGlobalStatesPagesStates);
    expect(Application.ContextMenuItems).toBe(ContextMenuItems);
    expect(Application.SettingsSections).toBe(SettingsSections);
    expect(Application.InstanceCreationSections).toBe(InstanceCreationSections);
  });

  it("preserves context-key identity", () => {
    const contextKeys = [
      TranslationsContextKey,
      AuthStatesContextKey,
      LaunchStatesContextKey,
      InstanceLogsContextKey,
      LaunchInstanceContextKey,
      CloseInstanceContextKey,
    ];

    expect(new Set(contextKeys).size).toBe(contextKeys.length);
    expect(Application.TranslationsContextKey).toBe(TranslationsContextKey);
    expect(Application.AuthStatesContextKey).toBe(AuthStatesContextKey);
    expect(Application.LaunchStatesContextKey).toBe(LaunchStatesContextKey);
    expect(Application.InstanceLogsContextKey).toBe(InstanceLogsContextKey);
    expect(Application.LaunchInstanceContextKey).toBe(LaunchInstanceContextKey);
    expect(Application.CloseInstanceContextKey).toBe(CloseInstanceContextKey);
  });

  it("preserves tab catalog values", () => {
    expect(SettingsSections.map(section => section.id)).toStrictEqual([
      "general",
      "user-interface",
      "minecraft",
      "java",
      "extensions",
      "plugin-playground",
    ]);
    expect(InstanceCreationSections.map(section => section.id)).toStrictEqual([
      "clean-minecraft",
      "modrinth",
      "ftb-legacy",
      "curseforge",
      "atlauncher",
    ]);
  });

  it("preserves application configuration values", () => {
    expect(ApplicationRootID).toBe("#app");
    expect(ApplicationName).toBe("Kaede");
    expect(DefaultLocale).toBe("en");
    expect(CSSThemeExtensions).toStrictEqual({
      "Enabled" : ".css",
      "Disabled": ".css.disabled",
    });
    expect(Object.keys(DefaultGlobalStatesPagesStates)).toStrictEqual([
      "home",
      "library",
      "settings",
      "add-instance",
      "none",
    ]);
    const customSettings =
      DefaultGlobalStatesPagesStates["add-instance"].customSettings ?? [];

    expect(customSettings.map(setting => setting.input?.placeholder))
      .toStrictEqual(["JVM arguments", "Game arguments"]);
    expect(ContextMenuItems.map(item => item.name)).toStrictEqual([
      "Restart UI",
      "Show Logs",
      "Open Root Folder",
      "Open Instance Folder",
    ]);
  });
});
