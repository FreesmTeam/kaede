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

import { authenticateWithXboxLive } from "@/lib/auth/scopes/authenticate-with-xbox-live.ts";
import { authorizeWithXsts } from "@/lib/auth/scopes/authorize-with-xsts.ts";
import { fetchMinecraftProfile } from "@/lib/auth/scopes/fetch-minecraft-profile.ts";
import { fetchMinecraftToken } from "@/lib/auth/scopes/fetch-minecraft-token.ts";
import { fetchSkinAsBase64 } from "@/lib/auth/scopes/fetch-skin-as-base64.ts";
import type {
  MicrosoftTokensType,
  MinecraftProfileType,
  MinecraftTokenType,
  SignInStatusType,
  XboxTokenType,
} from "@/types/auth/microsoft-auth.type.ts";
import type { AccountType } from "@/types/configs/account.type.ts";

/**
 * @returns an account entry ready for being written into 'accounts.json'
 * @throws a human-readable 'Error' from the failed step
 */
export async function completeAuthenticationChain({
  microsoftTokens,
  onStatus,
}: {
  "microsoftTokens": MicrosoftTokensType;
  "onStatus"      ?: (status: SignInStatusType) => void;
}): Promise<AccountType> {
  onStatus?.("xbox-live");
  const xboxLiveToken: XboxTokenType =
    await authenticateWithXboxLive(microsoftTokens.accessToken);

  onStatus?.("xsts");
  const xstsToken: XboxTokenType = await authorizeWithXsts(xboxLiveToken);

  onStatus?.("minecraft-token");
  const minecraftToken: MinecraftTokenType = await fetchMinecraftToken(xstsToken);

  onStatus?.("profile");
  const profile: MinecraftProfileType =
    await fetchMinecraftProfile(minecraftToken.accessToken);

  onStatus?.("finalizing");
  const skin: AccountType["skin"] = await fetchSkinAsBase64(profile);

  return {
    "msa": {
      "token"       : minecraftToken.accessToken,
      "refreshToken": microsoftTokens.refreshToken,
    },
    "profile": {
      "uuid": profile.uuid,
      "name": profile.name,
      "type": "msa",
    },
    skin,
  };
}
