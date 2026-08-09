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

import { fetch } from "@tauri-apps/plugin-http";

import { ModrinthAPI } from "@/constants/modrinth.ts";
import type {
  ModrinthSearchArgumentsType,
  ModrinthSearchResponseType,
} from "@/types/modrinth/search.type.ts";

// '[["versions:1.20.1"],["categories:fabric","categories:forge"]]'
function buildFacets({
  gameVersions = [],
  loaders = [],
}: Pick<ModrinthSearchArgumentsType, "gameVersions" | "loaders">): string {
  const facets: Array<Array<string>> = [[`project_type:${ModrinthAPI.ProjectType}`]];

  if (gameVersions.length > 0) {
    facets.push(gameVersions.map(version => `versions:${version}`));
  }

  if (loaders.length > 0) {
    facets.push(loaders.map(loader => `categories:${loader}`));
  }

  return JSON.stringify(facets);
}

export async function search({
  query = "",
  gameVersions = [],
  loaders = [],
  offset = 0,
  limit = ModrinthAPI.PageSize,
}: ModrinthSearchArgumentsType): Promise<ModrinthSearchResponseType> {
  const parameters = new URLSearchParams({
    "facets": buildFacets({ gameVersions, loaders }),
    "index" : ModrinthAPI.SortIndex,
    "offset": offset.toString(),
    "limit" : limit.toString(),
  });

  if (query !== "") {
    parameters.set("query", query);
  }

  const response: Response = await fetch(`${ModrinthAPI.Endpoints.Search}?${parameters}`);

  if (!response.ok) {
    throw new Error(`Modrinth answered with the status ${response.status}`);
  }

  const parsed: unknown = await response.json();

  if (typeof parsed !== "object" || parsed === null) {
    throw new TypeError("Modrinth returned an invalid search response");
  }

  if (!("hits" in parsed) || !Array.isArray(parsed.hits)) {
    throw new TypeError("No hits in the Modrinth search response");
  }

  return parsed as ModrinthSearchResponseType;
}
