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

import { extensionStates } from "@/states/extension.ts";
import { globalStates } from "@/states/global.ts";
import { instanceStates } from "@/states/instance.ts";
import { javaStates } from "@/states/java.ts";
import { modalStates } from "@/states/modal.ts";
import { codeOutput, codeToEvaluate } from "@/states/plugin-playground.ts";
import { serverProcesses } from "@/states/servers.ts";

export default {
  extensionStates,
  globalStates,
  instanceStates,
  javaStates,
  modalStates,
  codeOutput,
  codeToEvaluate,
  serverProcesses,
};