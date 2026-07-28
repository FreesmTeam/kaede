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

import { Routes } from "@/constants/routes.ts";
import type { RouteType } from "@/types/application/route.type.ts";

export function getInitialPage(): RouteType {
  const searchParameters: URLSearchParams = new URLSearchParams(location.search);
  const route: string | null = searchParameters.get("route");

  if (!route) {
    return Routes.Home;
  }

  for (const path of Object.values(Routes)) {
    if (route === path) {
      return path;
    }
  }

  return Routes.Home;
}
