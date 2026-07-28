import { DefaultInstanceSettings } from "@/constants/launcher.ts";
import { GlobalObject } from "@/extendable/global-object.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

export const DefaultGlobalStatesPagesStates: GlobalStatesType["pages"]["states"] = {
  "home"        : {},
  "library"     : {},
  "settings"    : { "tab": "general" },
  "add-instance": {

    /*
     * Preferably, we should not interfere with the customizable options
     * that were made purely for extensions. However, I wanted to use
     * these type of things so many times because it is simpler for me, lol
     */
    "customSettings": [
      {
        "input": {
          "onInput": (
            value: string,
            currentInstance: GlobalStatesType["pages"]["states"]["add-instance"]["instance"],
          ): void => {
            if (!currentInstance) {
              return;
            }

            const jvmArguments: Array<string> =
              GlobalObject.libs.Launcher.Arguments.splitArguments(value);

            GlobalObject.libs.GlobalStateHelpers.Pages.addToState("add-instance", {
              "instance": {
                ...currentInstance,
                "add": {
                  ...currentInstance.add,
                  "jvmArguments": jvmArguments,
                },
              },
            });
          },
          "placeholder"  : "JVM arguments",
          "iconClassName": "i-lucide-braces",
          "defaultValue" : (): string | undefined => {
            const currentInstance =
              GlobalObject.libs.GlobalStateHelpers.Pages.getState("add-instance")?.instance;

            if (!currentInstance) {
              return GlobalObject.libs.Launcher.Arguments.joinArguments(
                DefaultInstanceSettings.add?.jvmArguments,
              );
            }

            return GlobalObject.libs.Launcher.Arguments.joinArguments(
              currentInstance.add.jvmArguments,
            );
          },
          "debounceTime": 300,
          "tooltip"     : "Specify your JVM arguments here",
          "type"        : "text",
        },
      },
      {
        "input": {
          "onInput": (
            value: string,
            currentInstance: GlobalStatesType["pages"]["states"]["add-instance"]["instance"],
          ): void => {
            if (!currentInstance) {
              return;
            }

            const gameArguments: Array<string> =
              GlobalObject.libs.Launcher.Arguments.splitArguments(value);

            GlobalObject.libs.GlobalStateHelpers.Pages.addToState("add-instance", {
              "instance": {
                ...currentInstance,
                "add": {
                  ...currentInstance.add,
                  "gameArguments": gameArguments,
                },
              },
            });
          },
          "placeholder"  : "Game arguments",
          "iconClassName": "i-lucide-gamepad-2",
          "defaultValue" : (): string | undefined => {
            const currentInstance =
              GlobalObject.libs.GlobalStateHelpers.Pages.getState("add-instance")?.instance;

            if (!currentInstance) {
              return GlobalObject.libs.Launcher.Arguments.joinArguments(
                DefaultInstanceSettings.add?.gameArguments,
              );
            }

            return GlobalObject.libs.Launcher.Arguments.joinArguments(
              currentInstance.add.gameArguments,
            );
          },
          "debounceTime": 300,
          "tooltip"     : "Specify your game arguments here",
          "type"        : "text",
        },
      },
    ],
  },
  "none": {},
};
