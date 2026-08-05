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

import { authorizeInteractively } from "@/lib/auth/scopes/authorize-interactively.ts";
import {
  completeAuthenticationChain,
} from "@/lib/auth/scopes/complete-authentication-chain.ts";
import { requestMicrosoftTokens } from "@/lib/auth/scopes/request-microsoft-tokens.ts";
import Errors from "@/lib/errors";
import { log } from "@/lib/logging/log.ts";
import type {
  MicrosoftTokensType,
  SignInResultType,
  SignInStatusType,
} from "@/types/auth/microsoft-auth.type.ts";
import type { AccountType } from "@/types/configs/account.type.ts";

// An interactive Microsoft sign-in
export async function signInWithMicrosoft({
  onStatus,
}: {
  "onStatus"?: (status: SignInStatusType) => void;
} = {}): Promise<SignInResultType> {
  try {
    onStatus?.("authorizing");
    const { code, redirectUri, codeVerifier } = await authorizeInteractively();

    onStatus?.("exchanging-code");
    const microsoftTokens: MicrosoftTokensType = await requestMicrosoftTokens({
      "kind": "authorization-code",
      code,
      redirectUri,
      codeVerifier,
    });

    const account: AccountType = await completeAuthenticationChain({
      microsoftTokens,
      onStatus,
    });

    log.info(
      __PRE_BUNDLED_FILENAME__,
      `Signed in as '${account.profile.name}' (${account.profile.uuid})`,
    );

    return {
      "success": true,
      account,
    };
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "The Microsoft sign-in failed:",
      Errors.prettify(error),
    );

    return {
      "success": false,
      "reason" : error instanceof Error
        ? error.message
        : "An unknown error occurred during the sign-in",
    };
  }
}
