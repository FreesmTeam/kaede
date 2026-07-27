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

import serialize from "serialize-javascript";

import type { BrokerServerProcess } from "@/lib/capability-broker";
import { serveCode } from "@/lib/txiki/serve-code.ts";

type LightResponse<T> = Promise<T> | T;
type GetCallback = (request: {
  "params": Record<string, string>;
}) => LightResponse<unknown>;
type PostCallback = (request: {
  "body"  : unknown;
  "params": Record<string, string>;
}) => LightResponse<unknown>;

interface TrustedPluginServerBuilder {
  get(path: string, callback: GetCallback): Txiki;
  post(path: string, callback: PostCallback): Txiki;
  defineGlobal(name: string, value: unknown): Txiki;
}

const identifierStartPattern = /^[$_\p{ID_Start}]$/u;
const identifierContinuePattern = /^[$_\p{ID_Continue}]$/u;
const reservedGlobalNames = new Set(`
  arguments await break case catch class const continue
  debugger default delete do else enum eval export extends
  false finally for function if implements import in instanceof interface
  let new null package private protected public return static super switch
  this throw true try typeof var void while with yield
  routes readBody toResponse
`.trim().split(/\s+/u));
const serverIdState = { "next": 0 };

function assertValidGlobalName(name: string): void {
  const [firstCharacter, ...remainingCharacters] = [...name];
  const hasValidIdentifierCharacters = firstCharacter !== undefined &&
    identifierStartPattern.test(firstCharacter) &&
    remainingCharacters.every(character => {
      return character === "\u{200C}" ||
        character === "\u{200D}" ||
        identifierContinuePattern.test(character);
    });

  if (!hasValidIdentifierCharacters || reservedGlobalNames.has(name)) {
    throw new TypeError(`Invalid Txiki global identifier: ${JSON.stringify(name)}`);
  }
}

function createServerName(): string {
  serverIdState.next += 1;

  return `txiki-${serverIdState.next}`;
}

export default class Txiki implements TrustedPluginServerBuilder {
  private readonly paths: {
    "GET" : Map<string, string>;
    "POST": Map<string, string>;
  } = {
    "GET" : new Map,
    "POST": new Map,
  };

  private readonly globals = new Map<string, string>;

  private serializeRoutes(map: Map<string, string>): string {
    if (map.size === 0) {
      return "{}";
    }

    const entries: Array<string> = [];

    for (const [path, callback] of map) {
      entries.push(`${JSON.stringify(path)}:${callback}`);
    }

    return `{${entries.join(",")}}`;
  }

  private transformDefinedGlobals(): string {
    return [...this.globals.entries()]
      .map(([name, value]) => `const ${name}=${value};`)
      .join("");
  }

  private createServerCode(): string {
    const globals = this.transformDefinedGlobals();
    const getRoutes = this.serializeRoutes(this.paths.GET);
    const postRoutes = this.serializeRoutes(this.paths.POST);

    return [
      globals,
      `const routes={GET:${getRoutes},POST:${postRoutes}};`,
      "export default{async fetch(request){",
      "const url=new URL(request.url);",
      "const method=request.method;",
      "const methodRoutes=routes[method];",
      "if(!methodRoutes)return new Response(\"Method Not Allowed\",{status:405});",
      "const callback=methodRoutes[url.pathname];",
      "if(!callback)return new Response(\"Not Found\",{status:404});",
      "const params={};",
      "url.searchParams.forEach((value,key)=>{params[key]=value});",
      "try{",
      "const input=method===\"POST\"",
      "?{body:await readBody(request),params}",
      ":{params};",
      "return toResponse(await callback(input));",
      "}catch(error){",
      "console.error(\"Handler error:\",error);",
      "return new Response(\"Internal Server Error\",{status:500});",
      "}}};",
      "async function readBody(request){",
      "const type=request.headers.get(\"content-type\")||\"\";",
      "return type.includes(\"application/json\")?await request.json():await request.text();",
      "}",
      "function toResponse(value){",
      "if(value instanceof Response)return value;",
      "if(typeof value===\"string\")return new Response(value,",
      "{headers:{\"Content-Type\":\"text/plain; charset=utf-8\"}});",
      "return new Response(JSON.stringify(value),",
      "{headers:{\"Content-Type\":\"application/json\"}});",
      "}",
    ].join("");
  }

  public get(path: string, callback: GetCallback): Txiki {
    this.paths.GET.set(path, callback.toString());

    return this;
  }

  public post(path: string, callback: PostCallback): Txiki {
    this.paths.POST.set(path, callback.toString());

    return this;
  }

  public defineGlobal(name: string, value: unknown): Txiki {
    assertValidGlobalName(name);
    this.globals.set(name, serialize(value, { "unsafe": true, "ignoreFunction": false }));

    return this;
  }

  public async listen(requestedPort?: number): Promise<BrokerServerProcess | undefined> {
    if (requestedPort !== undefined) {
      throw new RangeError([
        "Txiki ports are assigned atomically by the host broker;",
        "renderer-selected ports are unsupported",
      ].join(" "));
    }

    return await serveCode(createServerName(), this.createServerCode());
  }
}
