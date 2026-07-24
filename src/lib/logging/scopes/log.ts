import { Host } from "@/lib/capability-broker";
import { capitalize } from "@/lib/general/scopes/capitalize.ts";
import type { LogMethodType } from "@/types/logging/log-method.type.ts";

const nonDebugModeMessage: string = "  " +
  "log#debug method points to lod#__debug-undefined. What is happening?";

function invokeLog(
  level: number,
  message: string,
  location: string,
): void {
  /*
   * We do not care about promises here
   * Yeah, that can possibly lead to racing conditions...
   */
  const brokerLevel = ({
    "2": "debug",
    "3": "info",
    "4": "warn",
    "5": "error",
  } as const)[level as 2 | 3 | 4 | 5];

  Host.logs.write({
    "level": brokerLevel,
    message,
    location,
  });
}
export const log = {

  /*
   * 'log#debug' will point to the '__debug-defined' when debug mode is enabled
   */
  "__debug-defined": (prefix: string, ...input: string[]): void => {
    invokeLog(2, input.join(" "), prefix);
  },

  /*
   * 'log#debug' will point to the '__debug-undefined' when debug mode is disabled
   */
  "__debug-undefined": ((): void => {}) as LogMethodType,

  /*
   * Actual logging methods
   */
  "debug": ((): void => {}) as LogMethodType,
  "info" : (prefix: string, ...input: string[]): void => {
    invokeLog(3, input.join(" "), prefix);
  },
  "warn": (prefix: string, ...input: string[]): void => {
    invokeLog(4, input.join(" "), prefix);
  },
  "error": (prefix: string, ...input: string[]): void => {
    invokeLog(5, input.join(" "), prefix);
  },

  /*
   * Some log messages have the same structure
   */
  "templates": {
    "json": {
      "contents": (label: string, data: unknown): string => (

        /*
         * Assemble the log message only if debug messages will be logged
         * since JSON#stringify method may produce an expensive output
         */
        label + ":\n" + (
          log.debug === log["__debug-undefined"]
            ? nonDebugModeMessage
            : JSON.stringify(data, null, 2)
        )
      ),
    },
    "hooks": {
      "iterate": {
        "start": (key: string, position: "before" | "after", length: number): string => (
          [
            `Starting iterating through hooks for '${key}.${position}'.`,
            `Array length: ${length}`,
          ].join(" ")
        ),
        "execution": (
          key: string,
          position: "before" | "after",
          index: number,
          type: "sync" | "async",
        ): string => (
          `'${key}.${position}' iterate: '${index}' index. ${capitalize(type)} hook execution`
        ),
        "response": (
          key: string,
          value: unknown,
          position: "before" | "after",
          index: number,
          time: number,
        ): string => (

          /*
           * Assemble the log message only if debug messages will be logged
           * since JSON#stringify method may produce an expensive output
           */
          [
            `'${key}.${position}' iterate: '${index}' index.`,
            `Hook execution ended in ${time.toFixed(1)} ms.`,
            `Hook response:\n${
              log.debug === log["__debug-undefined"]
                ? nonDebugModeMessage
                : JSON.stringify(value, null, 2)
            }`,
          ].join(" ")
        ),
        "no-response": (
          key: string,
          position: "before" | "after",
          index: number,
          time: number,
          type: "sync" | "async",
        ): string => (
          [
            `'${key}.${position}' iterate: '${index}' index.`,
            `${capitalize(type)} hook executed in ${time.toFixed(1)} ms`,
          ].join(" ")
        ),
        "end": (key: string, position: "before" | "after", time: number): string => (
          `All '${key}.${position}' hooks were executed in ${time.toFixed(1)} ms`
        ),
      },
    },
  },
};
