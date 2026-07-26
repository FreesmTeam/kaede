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

import { log } from "@/lib/logging/scopes/log.ts";

type ServerMessage =
  | { "type": "log";   "payload": string; "ts": number }
  | { "type": "error"; "payload": { "path": string; "message": string }; "ts": number }
  | { "type": "meta";  "payload": Record<string, unknown>; "ts": number }
  | { "type": "pong";  "ts": number };

export class TxikiSocket {
  private ws       : WebSocket | null = null;
  private listeners: Map<string, Set<(message: ServerMessage) => void>> = new Map;

  constructor(private port: number, private path = "/__ws") {
    this.connect();
  }

  private connect(): void {
    this.ws = new WebSocket(`ws://localhost:${this.port}${this.path}`);

    this.ws.addEventListener("message", (event: MessageEvent<string>) => {
      const message: ServerMessage = JSON.parse(event.data);
      const subs = this.listeners.get(message.type);

      if (!subs) {
        return;
      }

      for (const callback of subs) {
        callback(message);
      }
    });
  }

  public on(type: string, callback: (message: ServerMessage) => void): () => boolean {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, (new Set));
    }

    const listenerSet = this.listeners.get(type);

    if (!listenerSet) {
      log.error(__PRE_BUNDLED_FILENAME__, "The requested listener set is invalid");

      return (): boolean => false;
    }

    listenerSet.add(callback);

    return (): boolean => {
      return listenerSet.delete(callback);
    };
  }

  public send(type: string, payload?: unknown): void {
    const data: string = JSON.stringify({ type, payload });

    this.ws?.send?.(data);
  }

  public dispose(): void {
    this.ws?.close?.();
    this.ws = null;
  }
}
