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

/**
 * ATTENTION: AI-generated (by Claude Opus 5 on 'max' reasoning)
 */

/*
 * A replica of the Tauri 'withGlobalTauri' option.
 *
 * The launcher itself imports the Tauri packages directly, so it never needs
 * the global. Two other things do: 'detectIsBrowser' treats a missing
 * 'window.__TAURI__' as proof that no backend exists, and extensions are
 * written against the global namespace. Both are satisfied by assembling the
 * very same packages the desktop build exposes.
 *
 * The imports are deferred until the internals have been installed, because
 * some plugins read 'window.__TAURI_OS_PLUGIN_INTERNALS__' while their module
 * is being evaluated
 */

import * as api from "@tauri-apps/api";
import * as clipboardManager from "@tauri-apps/plugin-clipboard-manager";
import * as dialog from "@tauri-apps/plugin-dialog";
import * as fs from "@tauri-apps/plugin-fs";
import * as http from "@tauri-apps/plugin-http";
import * as notification from "@tauri-apps/plugin-notification";
import * as opener from "@tauri-apps/plugin-opener";
import * as os from "@tauri-apps/plugin-os";
import * as process from "@tauri-apps/plugin-process";
import * as upload from "@tauri-apps/plugin-upload";

export async function exposeGlobalTauri(): Promise<void> {
  window.__TAURI__ = {
    ...api,
    clipboardManager,
    dialog,
    fs,
    http,
    notification,
    opener,
    os,
    process,
    upload,
  } satisfies Window["__TAURI__"];
}
