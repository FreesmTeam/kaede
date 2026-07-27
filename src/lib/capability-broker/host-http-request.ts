import type { HostHttpRequestInit } from "@/lib/capability-broker/types.ts";

const HOST_HTTP_REQUEST_INIT_FIELDS: ReadonlySet<PropertyKey> = new Set([
  "method",
  "headers",
  "body",
]);
const UNSUPPORTED_REQUEST_INIT_FIELDS: ReadonlyArray<string> = [
  "attributionReporting",
  "browsingTopics",
  "cache",
  "credentials",
  "duplex",
  "integrity",
  "keepalive",
  "mode",
  "priority",
  "redirect",
  "referrer",
  "referrerPolicy",
  "signal",
  "window",
];

export function validateHostHttpFetchArguments(
  input: unknown,
  init?: HostHttpRequestInit,
): HostHttpRequestInit | undefined {
  if (typeof Request === "function" && input instanceof Request) {
    throw new TypeError(
      "Host.http.fetch does not accept Request input; pass a string or URL instead",
    );
  }

  if (typeof input !== "string" && !(input instanceof URL)) {
    throw new TypeError("Host.http.fetch input must be a string or URL");
  }

  if (init === undefined) {
    return undefined;
  }

  if (typeof init !== "object" || init === null) {
    throw new TypeError("Host.http.fetch init must be an object");
  }

  for (const field of UNSUPPORTED_REQUEST_INIT_FIELDS) {
    if (Reflect.has(init, field)) {
      throw new TypeError(
        `Host.http.fetch init does not support field ${JSON.stringify(field)}`,
      );
    }
  }

  let current: object | null = init;

  while (current !== null && current !== Object.prototype) {
    for (const field of Reflect.ownKeys(current)) {
      if (!HOST_HTTP_REQUEST_INIT_FIELDS.has(field)) {
        throw new TypeError(
          `Host.http.fetch init does not support field ${JSON.stringify(String(field))}`,
        );
      }
    }

    current = Object.getPrototypeOf(current) as object | null;
  }

  const validated: {
    "method" ?: string;
    "headers"?: HeadersInit;
    "body"   ?: BodyInit | null;
  } = {};

  Object.setPrototypeOf(validated, null);

  if (Reflect.getOwnPropertyDescriptor(init, "method") !== undefined) {
    validated.method = init.method;
  }
  if (Reflect.getOwnPropertyDescriptor(init, "headers") !== undefined) {
    validated.headers = init.headers;
  }
  if (Reflect.getOwnPropertyDescriptor(init, "body") !== undefined) {
    validated.body = init.body;
  }

  return Object.freeze(validated);
}
