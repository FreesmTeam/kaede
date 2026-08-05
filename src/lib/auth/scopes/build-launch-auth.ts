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

import { decodeJwtPayload } from "@/lib/auth/scopes/decode-jwt-payload.ts";
import type { LaunchAuthType } from "@/types/auth/microsoft-auth.type.ts";
import type { AccountType } from "@/types/configs/account.type.ts";

/**
 * Transforms a stored account into the auth data for the launch arguments
 */
export function buildLaunchAuth(account: AccountType): LaunchAuthType {
  if (account.msa === null) {
    return {
      "username": account.profile.name,
      "token"   : "none",
      "uuid"    : account.profile.uuid,
      "type"    : "legacy",
      "xuid"    : "",
    };
  }

  const payload: Record<string, unknown> | null = decodeJwtPayload(account.msa.token);
  const xuid: string = typeof payload?.xuid === "string" ? payload.xuid : "";

  return {
    "username": account.profile.name,
    "token"   : account.msa.token,
    "uuid"    : account.profile.uuid,
    "type"    : "msa",
    xuid,
  };
}
