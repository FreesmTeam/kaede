import type { BrowserGrantGuard } from "@/lib/browser/scopes/browser-preview-grants.ts";
import type {
  BrokerBytes,
  NetworkHttpRequest,
  NetworkHttpResponse,
  NetworkPermissionRequest,
  PermissionRequest,
} from "@/types/extensions/permission.type.ts";

function requestBody(body: string | BrokerBytes | undefined): string | ArrayBuffer | undefined {
  if (body === undefined || typeof body === "string") {
    return body;
  }

  return Uint8Array.from(body).buffer;
}

const REDIRECT_STATUSES: ReadonlySet<number> = new Set([301, 302, 303, 307, 308]);
const POST_TO_GET_REDIRECT_STATUSES: ReadonlySet<number> = new Set([301, 302]);

function isNetworkGrantAllowed(
  grant: PermissionRequest,
  url: URL,
  method: NetworkHttpRequest["method"],
): grant is NetworkPermissionRequest {
  return typeof grant !== "string" &&
    grant.id === "network/http" &&
    grant.scope.origins.includes(url.origin) &&
    grant.scope.methods.includes(method);
}

function requireNetworkGrant(
  requireGrant: BrowserGrantGuard,
  url: URL,
  method: NetworkHttpRequest["method"],
): void {
  if (requireGrant("network/http").every(grant => {
    return !isNetworkGrantAllowed(grant, url, method);
  })) {
    throw new Error(
      `Browser preview network request is outside its grant: ${url.href}`,
    );
  }
}

function isRedirect(status: number): boolean {
  return REDIRECT_STATUSES.has(status);
}

function redirectedMethod(
  status: number,
  method: NetworkHttpRequest["method"],
): NetworkHttpRequest["method"] {
  if (method === "POST" && POST_TO_GET_REDIRECT_STATUSES.has(status)) {
    return "GET";
  }

  return status === 303 && method !== "HEAD" ? "GET" : method;
}

function removeBodyHeaders(
  headers: ReadonlyArray<Readonly<[string, string]>>,
): Array<[string, string]> {
  return headers.filter(([name]) => {
    return !["content-length", "content-type", "transfer-encoding"]
      .includes(name.toLowerCase());
  }).map(([name, value]) => [name, value]);
}

function removeSensitiveHeaders(
  headers: ReadonlyArray<Readonly<[string, string]>>,
): Array<[string, string]> {
  return headers.filter(([name]) => {
    return !["authorization", "cookie", "proxy-authorization"]
      .includes(name.toLowerCase());
  }).map(([name, value]) => [name, value]);
}

async function toNetworkResponse(response: Response): Promise<NetworkHttpResponse> {
  const headers = [...response.headers].map(header => Object.freeze(header));
  const body = new Uint8Array(await response.arrayBuffer());

  return Object.freeze({
    "status"    : response.status,
    "statusText": response.statusText,
    "headers"   : Object.freeze(headers),
    "body"      : Object.freeze([...body]),
  });
}

function networkRequestInit(
  method: NetworkHttpRequest["method"],
  headers: ReadonlyArray<Readonly<[string, string]>>,
  body: string | ArrayBuffer | undefined,
): RequestInit {
  const init: RequestInit = {
    method,
    "credentials": "omit",
    "headers"    : headers.map(([name, value]) => [name, value]),
    "redirect"   : "manual",
  };

  if (body !== undefined && method !== "GET" && method !== "HEAD") {
    init.body = body;
  }

  return init;
}

export async function fetchWithNetworkGrants(
  request: NetworkHttpRequest,
  requireGrant: BrowserGrantGuard,
): Promise<NetworkHttpResponse> {
  let currentUrl = new URL(request.url);
  let currentMethod = request.method;
  let headers: Array<[string, string]> = request.headers
    .map(([name, value]) => [name, value]);
  let body = requestBody(request.body);
  const visited = new Set([currentUrl.href]);

  while (true) {
    requireNetworkGrant(requireGrant, currentUrl, currentMethod);
    const response = await fetch(
      currentUrl.href,
      networkRequestInit(currentMethod, headers, body),
    );

    requireNetworkGrant(requireGrant, currentUrl, currentMethod);
    if (response.type === "opaqueredirect") {
      throw new Error("Browser preview cannot safely inspect an opaque redirect");
    }

    if (!isRedirect(response.status)) {
      return toNetworkResponse(response);
    }

    const location = response.headers.get("location");

    if (location === null) {
      return toNetworkResponse(response);
    }

    const nextUrl = new URL(location, currentUrl);

    if (visited.has(nextUrl.href)) {
      throw new Error("Browser preview HTTP redirect cycle detected");
    }
    visited.add(nextUrl.href);

    const nextMethod = redirectedMethod(response.status, currentMethod);

    if (nextMethod !== currentMethod) {
      body = undefined;
      headers = removeBodyHeaders(headers);
    }
    if (nextUrl.origin !== currentUrl.origin) {
      headers = removeSensitiveHeaders(headers);
    }

    currentUrl = nextUrl;
    currentMethod = nextMethod;
  }
}
