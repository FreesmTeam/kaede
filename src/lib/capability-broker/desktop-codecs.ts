import type {
  BrokerHttpRequest,
  BrokerRequest,
  BrokerResponse,
  RawBrokerEvent,
} from "@/lib/capability-broker/contract.ts";
import { UnexpectedBrokerResponseError } from "@/lib/capability-broker/errors.ts";
import { validateHostHttpFetchArguments } from "@/lib/capability-broker/host-http-request.ts";
import {
  type HostHttpRequestInit,
  type ProcessEvent,
  type ProcessHandle,
} from "@/lib/capability-broker/types.ts";
import type {
  InitializationFinalizationReport,
  InitialStateType,
  ParsedFile,
} from "@/types/application/initial-state.type.ts";
import type {
  BrokerHeaders,
  ExternalStorageTarget,
  HttpMethod,
  NetworkHttpRequest,
  NetworkHttpResponse,
  ProcessResult,
} from "@/types/extensions/permission.type.ts";

export type BrokerCall = (
  request: BrokerRequest,
  onEvent?: (event: RawBrokerEvent) => void,
) => Promise<BrokerResponse>;

const HTTP_METHODS: ReadonlySet<string> = new Set([
  "DELETE",
  "GET",
  "HEAD",
  "OPTIONS",
  "PATCH",
  "POST",
  "PUT",
]);
const BODYLESS_RESPONSE_STATUSES: ReadonlySet<number> = new Set([204, 205, 304]);

export function expectResponse<Kind extends BrokerResponse["kind"]>(
  response: BrokerResponse,
  kind: Kind,
): Extract<BrokerResponse, { "kind": Kind }> {
  if (response.kind !== kind) {
    throw new UnexpectedBrokerResponseError(kind, response.kind);
  }

  return response as Extract<BrokerResponse, { "kind": Kind }>;
}

export function asProcessHandle(handle: string): ProcessHandle {
  return handle as ProcessHandle;
}

function toParsedFile(parsedFile: ParsedFile): ParsedFile {
  switch (parsedFile.status) {
    case "loaded": {
      return Object.freeze({ "status": parsedFile.status, "data": parsedFile.data });
    }
    case "missing": {
      return Object.freeze({ "status": parsedFile.status });
    }
    case "corrupt": {
      return Object.freeze({
        "status": parsedFile.status,
        "raw"   : parsedFile.raw,
        "error" : parsedFile.error,
      });
    }
  }
}

export function toInitialState(state: InitialStateType): InitialStateType {
  return Object.freeze({
    "basic" : Object.freeze({ ...state.basic }),
    "parsed": Object.freeze({
      "config"      : toParsedFile(state.parsed.config),
      "accounts"    : toParsedFile(state.parsed.accounts),
      "instances"   : toParsedFile(state.parsed.instances),
      "translations": toParsedFile(state.parsed.translations),
    }),
  });
}

export function toInitializationFinalizationReport(
  report: InitializationFinalizationReport,
): InitializationFinalizationReport {
  return Object.freeze({
    "createdDirectories": Object.freeze([...report.createdDirectories]),
    "javaMajor"         : report.javaMajor,
    "javaMajorSource"   : report.javaMajorSource,
  });
}

function asHttpMethod(method: string): HttpMethod {
  if (!HTTP_METHODS.has(method)) {
    throw new TypeError(`Unsupported HTTP method: ${JSON.stringify(method)}`);
  }

  return method as HttpMethod;
}

export async function toBrokerHttpRequest(
  input: string | URL,
  init?: HostHttpRequestInit,
): Promise<BrokerHttpRequest> {
  const validatedInit = validateHostHttpFetchArguments(input, init);

  const request = new Request(input, validatedInit);
  const method = asHttpMethod(request.method.toUpperCase());
  const body = method === "GET" || method === "HEAD"
    ? null
    : [...new Uint8Array(await request.arrayBuffer())];

  return {
    "url"    : request.url,
    method,
    "headers": [...request.headers].map(([name, value]) => ({ name, value })),
    body,
  };
}

export function toPluginHttpRequest(request: NetworkHttpRequest): BrokerHttpRequest {
  return {
    "url"    : request.url,
    "method" : request.method,
    "headers": request.headers.map(([name, value]) => ({ name, value })),
    "body"   : typeof request.body === "string"
      ? [...(new TextEncoder).encode(request.body)]
      : (request.body === undefined ? null : [...request.body]),
  };
}

export function toResponse(
  response: Extract<BrokerResponse, { "kind": "http" }>["response"],
): Response {
  if (response.status < 200 || response.status > 599) {
    throw new TypeError(
      `Broker HTTP response status ${response.status} cannot be represented as a Response`,
    );
  }

  const body = BODYLESS_RESPONSE_STATUSES.has(response.status)
    ? null
    : Uint8Array.from(response.body);

  return new BrokeredHttpResponse(body, {
    "status"    : response.status,
    "statusText": response.statusText,
    "headers"   : response.headers.map(({ name, value }) => [name, value]),
  }, response.url, response.redirected);
}

class BrokeredHttpResponse extends Response {
  readonly #url       : string;
  readonly #redirected: boolean;

  constructor(
    body: BodyInit | null,
    init: ResponseInit,
    url: string,
    redirected: boolean,
  ) {
    super(body, init);
    this.#url = url;
    this.#redirected = redirected;
  }

  override get url(): string {
    return this.#url;
  }

  override get redirected(): boolean {
    return this.#redirected;
  }

  override clone(): Response {
    const cloned = super.clone();

    return new BrokeredHttpResponse(cloned.body, {
      "status"    : cloned.status,
      "statusText": cloned.statusText,
      "headers"   : cloned.headers,
    }, this.url, this.redirected);
  }
}

export function toPluginHttpResponse(
  response: Extract<BrokerResponse, { "kind": "http" }>["response"],
): NetworkHttpResponse {
  const headers: BrokerHeaders = Object.freeze(
    response.headers.map(({ name, value }) => Object.freeze([name, value] as const)),
  );

  return Object.freeze({
    "status"    : response.status,
    "statusText": response.statusText,
    headers,
    "body"      : Object.freeze([...response.body]),
  } satisfies NetworkHttpResponse);
}

export function toProcessEvent(event: RawBrokerEvent): ProcessEvent | undefined {
  switch (event.kind) {
    case "stdout":
    case "stderr": {
      return Object.freeze({
        "kind"  : event.kind,
        "handle": asProcessHandle(event.handle),
        "bytes" : Uint8Array.from(event.bytes),
      });
    }
    case "terminated": {
      return Object.freeze({
        "kind"  : event.kind,
        "handle": asProcessHandle(event.handle),
        "code"  : event.code,
        "signal": event.signal,
      });
    }
    case "error":
    case "failed": {
      return Object.freeze({
        "kind"   : event.kind,
        "handle" : asProcessHandle(event.handle),
        "message": event.message,
      });
    }
    case "download_progress": {
      return undefined;
    }
    case "download_batch_progress": {
      return undefined;
    }
  }
}

export function externalStoragePath(target: ExternalStorageTarget): string {
  const segments = target.relativePath.split(/[\\/]/u);

  if (
    target.relativePath.startsWith("/") ||
    target.relativePath.startsWith("\\") ||
    segments.some(segment => segment === "" || segment === "." || segment === "..")
  ) {
    throw new TypeError(
      `Invalid external storage relative path: ${JSON.stringify(target.relativePath)}`,
    );
  }

  const separator = target.root.includes("\\") ? "\\" : "/";

  return target.root.endsWith(separator)
    ? target.root + segments.join(separator)
    : target.root + separator + segments.join(separator);
}

export function createProcessResult(
  code: number | null,
  signal: number | null,
  stdout: ReadonlyArray<number>,
  stderr: ReadonlyArray<number>,
): ProcessResult {
  return Object.freeze({
    code,
    signal,
    "stdout": Object.freeze([...stdout]),
    "stderr": Object.freeze([...stderr]),
  } satisfies ProcessResult);
}
