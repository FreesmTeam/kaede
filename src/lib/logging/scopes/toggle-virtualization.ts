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

import { ApplicationName } from "@/constants/application.ts";
import { Host } from "@/lib/capability-broker";
import GlobalStateHelpers from "@/lib/global-state-helpers";

export async function toggleVirtualization({
  virtualized,
  length,
}: {
  "virtualized": boolean;
  "length"     : number;
}): Promise<void> {
  if (virtualized && length >= 512) {
    const answer = await Host.dialogs.ask({
      "message": "Virtualization was enabled because your log file is big. " +
        "Disabling it may freeze your launcher for a bit. Do you want to disable virtualization?",
      "title": ApplicationName,
      "kind" : "warning",
    });

    if (!answer) {
      return;
    }
  }

  GlobalStateHelpers.Logs.toggle("virtualized");
}
