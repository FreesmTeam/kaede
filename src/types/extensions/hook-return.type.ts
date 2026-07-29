import type { HookResponseStatus } from "@/constants/application.ts";

type ExtensionResponseStatusType = typeof HookResponseStatus;

export type ExtensionStatusType = ExtensionResponseStatusType[keyof ExtensionResponseStatusType];
export type ExtensionHookResponseType<ResponseType> = ResponseType extends "nothing" ? void : {
  // 'stop' aborts a function that executed current hook
  "status"  : ExtensionStatusType;
  // If the 'status' is 'stop', function will return this field
  "response": ResponseType | Promise<ResponseType>;
};

/**
 * Used in '/src/declarations.ts'.
 * All hooks are either async or sync, and they are stored in the array to allow multiple hooks
 */
export type HookReturnType<
  ArgumentsType,
  ResponseType,
  IsPromise extends ("promise" | "non-promise") = "promise",
> = Array<(...arguments_: ArgumentsType[]) => (
  IsPromise extends "promise"
    ? Promise<ExtensionHookResponseType<ResponseType>>
    : ExtensionHookResponseType<ResponseType>
)>;
