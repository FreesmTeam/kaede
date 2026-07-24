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

import { ref } from "vue";

import typedDefaultPluginDraft from "../../types/fixtures/sandbox/playground-default.ts?raw";

const playgroundFixtureHeader =
  "/// <reference path=\"../../kaede-sandbox.d.ts\" />\n\n";

export function createPlaygroundDraft(fixtureSource: string): string {
  const normalizedSource = fixtureSource.replace(/\r\n?/gu, "\n");

  if (!normalizedSource.startsWith(playgroundFixtureHeader)) {
    throw new TypeError("Playground fixture is missing its sandbox type header");
  }

  return normalizedSource.slice(playgroundFixtureHeader.length);
}

const defaultPluginDraft = createPlaygroundDraft(typedDefaultPluginDraft);

export const codeToEvaluate = ref<string>(defaultPluginDraft);
