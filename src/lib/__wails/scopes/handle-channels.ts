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
  type WailsRuntimeType,
} from "@/lib/__wails/scopes/load-wails-runtime.ts";

/*
 * A bridge between a Tauri 'Channel' and a Wails event stream.
 *
 * Tauri lets a command take a 'Channel' and push messages into it. Wails has
 * no such concept: a call takes JSON and answers once. So every channel is
 * given an identifier, the identifier travels to Go as a plain string, and
 * everything the backend emits under 'kaede:stream:<id>' is forwarded into
 * the channel until the call that owns it settles
 */

const StreamEventPrefix: string = "kaede:stream:";

type ChannelLikeType = {
  "onmessage": (message: unknown) => void;
};

export type StreamType = {

  /** The identifier to hand to the Go service, empty when there is no channel. */
  "id": string;

  /** Detaches the forwarder. Always call this once the owning call settles. */
  "close": () => void;
};

const ClosedStream: StreamType = {
  "id"   : "",
  "close": (): void => {},
};

let nextStreamId: number = 1;

function isChannelLike(value: unknown): value is ChannelLikeType {
  return typeof (value as ChannelLikeType | undefined)?.onmessage === "function";
}

/**
 * Attaches a forwarder to a Tauri channel.
 *
 * @param channel - The channel the frontend passed into 'invoke'.
 *
 * @returns The stream identifier to pass to Go, and its detach function.
 */
export async function openStream(channel: unknown): Promise<StreamType> {
  if (!isChannelLike(channel)) {
    return ClosedStream;
  }

  const runtime: WailsRuntimeType | undefined = await loadWailsRuntime();

  if (runtime === undefined) {
    return ClosedStream;
  }

  const id: string = `${Date.now().toString(36)}-${nextStreamId++}`;
  const detach: () => void = runtime.Events.On(
    StreamEventPrefix + id,
    (received): void => {
      channel.onmessage(received.data);
    },
  );

  return { id, "close": detach };
}
