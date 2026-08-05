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

import { MicrosoftAuth } from "@/constants/launcher.ts";
import {
  completeAuthenticationChain,
} from "@/lib/auth/scopes/complete-authentication-chain.ts";
import { decodeJwtPayload } from "@/lib/auth/scopes/decode-jwt-payload.ts";
import { requestMicrosoftTokens } from "@/lib/auth/scopes/request-microsoft-tokens.ts";
import Errors from "@/lib/errors";
import { log } from "@/lib/logging/log.ts";
import type {
  EnsureFreshResultType,
  MicrosoftTokensType,
} from "@/types/auth/microsoft-auth.type.ts";
import type { AccountType } from "@/types/configs/account.type.ts";

export async function ensureFreshAccount(
  account: AccountType,
): Promise<EnsureFreshResultType> {
  if (account.msa === null) {
    return {
      account,
      "status": "fresh",
    };
  }

  const payload: Record<string, unknown> | null = decodeJwtPayload(account.msa.token);
  const expiration: number = typeof payload?.exp === "number"
    ? payload.exp * 1000
    // Just assume it is zero to refresh the token
    : 0;

  if (expiration - MicrosoftAuth.ExpirationMargin > Date.now()) {
    log.debug(
      __PRE_BUNDLED_FILENAME__,
      `The Minecraft token of '${account.profile.name}' is still fresh`,
    );

    return {
      account,
      "status": "fresh",
    };
  }

  log.warn(
    __PRE_BUNDLED_FILENAME__,
    `The Minecraft token of '${account.profile.name}' has expired, refreshing`,
  );

  try {
    const microsoftTokens: MicrosoftTokensType = await requestMicrosoftTokens({
      "kind"        : "refresh-token",
      "refreshToken": account.msa.refreshToken,
    });
    const refreshed: AccountType = await completeAuthenticationChain({
      microsoftTokens,
    });

    return {
      "account": refreshed,
      "status" : "refreshed",
    };
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      `Failed to refresh the '${account.profile.name}' account:`,
      Errors.prettify(error),
    );

    return {
      account,
      "status": "failed",
    };
  }
}
