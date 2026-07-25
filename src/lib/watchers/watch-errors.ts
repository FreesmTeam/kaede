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

import Errors from "@/lib/errors";
import { log } from "@/lib/logging/scopes/log.ts";

const handleError = (event: ErrorEvent): void => {
  log.error(__PRE_BUNDLED_FILENAME__, "Uncaught error:", Errors.prettify(event.error));
};
const handleRejection = (event: PromiseRejectionEvent): void => {
  log.error(__PRE_BUNDLED_FILENAME__, "Unhandled rejection:", Errors.prettify(event.reason));
};

export function watchErrors(): () => void {
  window.addEventListener("error", handleError);
  window.addEventListener("unhandledrejection", handleRejection);

  return (): void => {
    window.removeEventListener("error", handleError);
    window.removeEventListener("unhandledrejection", handleRejection);
  };
}
