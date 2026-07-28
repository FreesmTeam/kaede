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

import { catchAsyncResponseHooks } from "@/lib/hooks/catch-async-response-hooks.ts";
import { catchAsyncVoidHooks } from "@/lib/hooks/catch-async-void-hooks.ts";
import { catchSyncResponseHooks } from "@/lib/hooks/catch-sync-response-hooks.ts";
import { catchSyncVoidHooks } from "@/lib/hooks/catch-sync-void-hooks.ts";
import { handleHookResponse } from "@/lib/hooks/handle-hook-response.ts";

export default {
  catchAsyncResponseHooks,
  catchAsyncVoidHooks,
  catchSyncResponseHooks,
  catchSyncVoidHooks,
  handleHookResponse,
} as const;
