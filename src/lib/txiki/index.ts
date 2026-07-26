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

import ExtensionsManager from "@/lib/extensions-manager";
import type { ServerProcessType } from "@/types/application/server-process.type.ts";

type LightResponse<T> = Promise<T> | T;
type GetCallback = (request: { "params": Record<string, unknown> }) => LightResponse<unknown>;
type PostCallback = (request: {
  "body"  : unknown;
  "params": Record<string, unknown>;
}) => LightResponse<unknown>;

export default class Txiki {
  private paths: {
    "GET" : Map<string, string>;
    "POST": Map<string, string>;
  } = {
    "GET" : new Map,
    "POST": new Map,
  };

  private globals: Map<string, string> = new Map;

  private serializeRoutes(map: Map<string, string>): string {
    if (map.size === 0) {
      return "{}";
    }

    const entries: Array<string> = [];

    for (const [path, callback] of map) {
      entries.push(`${JSON.stringify(path)}: ${callback}`);
    }

    return `{\n${entries.join(",\n")}\n}`;
  }

  private transformDefinedGlobals(): string {
    return [...this.globals.entries()]
      .map(([name, value]) => `const ${name} = ${value};`)
      .join("");
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
    this.globals.set(name, serialize(value, { "unsafe": true }));

    return this;
  }

  public async listen(port: number): Promise<ServerProcessType | undefined> {
    const name: string = `txiki-${port}`;
    const generatedGlobals: string = this.transformDefinedGlobals();
    const getRoutes: string = this.serializeRoutes(this.paths.GET);
    const postRoutes: string = this.serializeRoutes(this.paths.POST);
    // eslint-disable-next-line vue/max-len
    const code: string = `${generatedGlobals}const routes={GET:${getRoutes},POST:${postRoutes}};export default{async fetch(e){const t=new URL(e.url),r=e.method,s=routes[r];if(!s)return new Response("Method Not Allowed",{status:405});const a=s[t.pathname];if(!a)return new Response("Not Found",{status:404});try{const s={};let n;if(t.searchParams.forEach((e,t)=>{s[t]=e}),"POST"===r){const t=(e.headers.get("content-type")||"").includes("application/json")?await e.json():await e.text();n=await a({body:t,params:s})}else n=await a({params:s});return toResponse(n)}catch(e){return console.error("Handler error:",e),new Response("Internal Server Error",{status:500})}}};function toResponse(e){return e instanceof Response?e:"string"==typeof e?new Response(e):new Response(JSON.stringify(e),{headers:{"Content-Type":"application/json"}})}`.trim();

    return await ExtensionsManager.serveCode(name, code, port);
  }
}
