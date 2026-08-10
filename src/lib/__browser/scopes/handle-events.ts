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

/*
 * A replica of the Tauri callback and event system.
 *
 * 'transformCallback' of the Tauri API registers a callback and returns
 * its numeric identifier, so utils like 'listen' and 'Channel' can pass
 * that identifier over IPC. There is no IPC in browsers, so the callbacks
 * are simply stored in a module-level map and are called directly
 */

type CallbackType = (payload: unknown) => void;
type ListenerType = {
  "event"    : string;
  "handlerId": number;
};

const callbacks: Map<number, CallbackType> = new Map;
const listeners: Map<number, ListenerType> = new Map;

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

// A replica of 'plugin:event|listen'. Returns the event listener identifier
export function addBrowserEventListener(event: string, handlerId: number): number {
  const eventId: number = nextId++;

  listeners.set(eventId, { event, handlerId });

  return eventId;
}

// A replica of 'plugin:event|unlisten'
export function removeBrowserEventListener(eventId: number): void {
  const listener: ListenerType | undefined = listeners.get(eventId);

  if (!listener) {
    return;
  }

  listeners.delete(eventId);
  callbacks.delete(listener.handlerId);
}

// A replica of 'AppHandle#emit'. Calls every listener of the event
export function emitBrowserEvent(event: string, payload: unknown): void {
  for (const [eventId, listener] of listeners) {
    if (listener.event !== event) {
      continue;
    }

    callbacks.get(listener.handlerId)?.({ event, "id": eventId, payload });
  }
}
