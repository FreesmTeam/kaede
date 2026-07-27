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

import { cancelAll } from "@/lib/launcher/scopes/fetching/cancel-all.ts";
import { downloadAssets } from "@/lib/launcher/scopes/fetching/download-assets.ts";
import { downloadClient } from "@/lib/launcher/scopes/fetching/download-client.ts";
import { downloadLibraries } from "@/lib/launcher/scopes/fetching/download-libraries.ts";
import { downloadLogging } from "@/lib/launcher/scopes/fetching/download-logging.ts";
import { fetchAllVersions } from "@/lib/launcher/scopes/fetching/fetch-all-versions.ts";
import { fetchMetadata } from "@/lib/launcher/scopes/fetching/fetch-metadata.ts";

export default {
  cancelAll,
  downloadAssets,
  downloadClient,
  downloadLibraries,
  downloadLogging,
  fetchAllVersions,
  fetchMetadata,
} as const;
