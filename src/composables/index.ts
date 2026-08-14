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

import { useConfigColors } from "@/composables/use-config-colors.ts";
import { useContextMenu } from "@/composables/use-context-menu.ts";
import { useLogResizer } from "@/composables/use-log-resizer.ts";
import { useLogSearch } from "@/composables/use-log-search.ts";
import { useLogSegmentation } from "@/composables/use-log-segmentation.ts";
import { useLogStream } from "@/composables/use-log-stream.ts";
import { useSkinRenderer } from "@/composables/use-skin-renderer.ts";

export default {
  useConfigColors,
  useContextMenu,
  useLogResizer,
  useLogSearch,
  useLogSegmentation,
  useLogStream,
  useSkinRenderer,
} as const;
