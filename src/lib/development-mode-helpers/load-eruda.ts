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

import { AsyncFunction } from "@/constants/application.ts";
import { Host } from "@/lib/capability-broker";

export async function loadEruda(): Promise<void> {
  const url: string = "https://cdn.jsdelivr.net/npm/eruda";
  const response: Response = await Host.http.fetch(url);
  const code: string = await response.text();
  const loader = new AsyncFunction(code);

  await loader();

  if (
    "eruda" in window && typeof window.eruda === "object" && window.eruda !== null &&
    "init" in window.eruda && typeof window.eruda.init === "function" &&
    "show" in window.eruda && typeof window.eruda.show === "function"
  ) {
    window.eruda.init();
    window.eruda.show();
  }
}
