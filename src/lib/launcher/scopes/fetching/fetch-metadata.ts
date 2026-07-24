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

import { LaunchStatus } from "@/constants/launcher.ts";
import { Host } from "@/lib/capability-broker";
import Errors from "@/lib/errors";
import { log } from "@/lib/logging/scopes/log.ts";
import type {
  LaunchKeyType,
  LaunchStatusType,
} from "@/types/launcher/launch/launch-status.type.ts";

export async function fetchMetadata({
  url,
  label,
  scope,
  prefix,
}: {
  "url"   : string;
  "label" : string;
  "scope" : Extract<LaunchKeyType, "PatchIndex" | "PatchMetadata" | "AssetIndex">;
  "prefix": string;
}): Promise<{ "data": unknown } | LaunchStatusType> {
  let response: Response;
  let data: unknown;

  try {
    log.debug(`${prefix}:${__PRE_BUNDLED_FILENAME__}`, `Fetching the ${label} from '${url}'`);

    response = await Host.http.fetch(url);
  } catch (error: unknown) {
    log.error(
      `${prefix}:${__PRE_BUNDLED_FILENAME__}`,
      `Could not fetch '${url}':`,
      Errors.prettify(error),
    );

    return LaunchStatus[scope].FailedToFetch;
  }

  try {
    data = await response.json();
  } catch (error: unknown) {
    log.error(
      `${prefix}:${__PRE_BUNDLED_FILENAME__}`,
      `Could not parse the ${label} from '${url}':`,
      Errors.prettify(error),
    );

    return LaunchStatus[scope].FailedToParse;
  }

  return { data };
}
