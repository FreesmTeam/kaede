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

export type ServerProcessType = {
  "name" : string;
  "port" : number;
  "value": {
    "pid"  : number;
    "kill" : () => Promise<void>;
    "write": (data: string | Uint8Array | number[]) => Promise<void>;
  };
};
export type ServerMetaType = {
  "name": string;
  "port": number;
};

export type ProgramSpecType =
  | { "type": "path";    "value": string }
  | { "type": "sidecar"; "value": string };

export type ProcessHandlersType = {
  "onOutput"?: (line: string, stream: "stdout" | "stderr") => void;
  "onExit"?  : (payload: { "pid": number; "code": number | null; "signal": number | null }) => void;
  "onError"? : (payload: { "pid": number; "message": string }) => void;
};

export type ProcessHandleType<Meta = unknown> = {
  "token": string;
  "pid"  : number;
  "kind" : string;
  "meta" : Meta;
  "kill" : () => Promise<void>;
  "write": (data: string | Uint8Array | number[]) => Promise<void>;
};

export type ProcessDtoType<Meta = unknown> = {
  "token": string;
  "pid"  : number;
  "kind" : string;
  "meta" : Meta;
};

export type RunResultType = {
  "code"   : number | null;
  "success": boolean;
  "stdout" : string;
  "stderr" : string;
};
