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

import {
  loadWailsRuntime,
  type WailsEventType,
  type WailsRuntimeType,
} from "@/lib/__wails/scopes/load-wails-runtime.ts";

/*
 * A replica of the Tauri callback and event system, bridged to Wails.
 *
 * 'transformCallback' of the Tauri API registers a callback and returns its
 * numeric identifier so that utils like 'listen' and 'Channel' can pass that
 * identifier over IPC. The Wails bridge keeps the same module-level registry
 * as the browser replica, and additionally subscribes to the Wails event of
 * the same name the first time somebody listens for it, so that events the Go
 * backend emits (for example 'process-output') reach the Tauri listeners
 */

type CallbackType = (payload: unknown) => void;
type ListenerType = {
  "event"    : string;
  "handlerId": number;
};

const callbacks: Map<number, CallbackType> = new Map;
const listeners: Map<number, ListenerType> = new Map;
const subscriptions: Map<string, () => void> = new Map;

let nextId: number = 1;

export function transformCallbackReplica(callback?: CallbackType, once?: boolean): number {
  const id: number = nextId++;

  callbacks.set(id, (payload: unknown): void => {
    if (once) {
      callbacks.delete(id);
    }

    callback?.(payload);
  });

  return id;
}

export function runCallbackReplica(id: number, payload: unknown): void {
  callbacks.get(id)?.(payload);
}

export function unregisterCallbackReplica(id: number): void {
  callbacks.delete(id);
}

// A replica of 'AppHandle#emit'. Calls every listener of the event
export function emitWailsEvent(event: string, payload: unknown): void {
  for (const [eventId, listener] of listeners) {
    if (listener.event !== event) {
      continue;
    }

    callbacks.get(listener.handlerId)?.({ event, "id": eventId, payload });
  }
}

/*
 * One Wails subscription is kept per event name for as long as the page
 * lives. Backend events are rare and the registry above is what actually
 * fans them out, so there is nothing to gain from tearing them down
 */
async function subscribeToBackend(event: string): Promise<void> {
  if (subscriptions.has(event)) {
    return;
  }

  const runtime: WailsRuntimeType | undefined = await loadWailsRuntime();

  if (runtime === undefined) {
    return;
  }

  // Guard against two listeners of the same event racing on the first await
  if (subscriptions.has(event)) {
    return;
  }

  subscriptions.set(
    event,
    runtime.Events.On(event, (received: WailsEventType): void => {
      emitWailsEvent(event, received.data);
    }),
  );
}

// A replica of 'plugin:event|listen'. Returns the event listener identifier
export async function addWailsEventListener(event: string, handlerId: number): Promise<number> {
  const eventId: number = nextId++;

  listeners.set(eventId, { event, handlerId });

  await subscribeToBackend(event);

  return eventId;
}

// A replica of 'plugin:event|unlisten'
export function removeWailsEventListener(eventId: number): void {
  const listener: ListenerType | undefined = listeners.get(eventId);

  if (!listener) {
    return;
  }

  listeners.delete(eventId);
  callbacks.delete(listener.handlerId);
}
