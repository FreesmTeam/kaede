import type { AccountType } from "@/types/configs/account.type.ts";

// Microsoft OAuth2 token
export type MicrosoftTokensType = {
  "accessToken" : string;
  "refreshToken": string;
  // In seconds, usually 3600
  "expiresIn"   : number;
};

/*
 * Xbox Live user authentication
 * XSTS authorization
 */
export type XboxTokenType = {
  "token"   : string;
  "userhash": string;
};

/*
 * A JWT (Minecraft Services).
 *
 * The expiration date and the XUID are extracted from its payload
 */
export type MinecraftTokenType = {
  "accessToken": string;
  // In seconds, usually 86400
  "expiresIn"  : number;
};

// Partial response of 'GET /minecraft/profile'
export type MinecraftProfileType = {
  "uuid" : string;
  "name" : string;
  "skins": Array<{
    "id"     : string;
    "state"  : string;
    "url"    : string;
    "variant": string;
  }>;
};

// Progress steps of the sign-in chain
export type SignInStatusType =
  | "authorizing"
  | "exchanging-code"
  | "xbox-live"
  | "xsts"
  | "minecraft-token"
  | "profile"
  | "finalizing";

// 'Auth#signInWithMicrosoft'
export type SignInResultType = {
  "success": true;
  "account": AccountType;
} | {
  "success": false;
  // Human-readable
  "reason" : string;
};

// 'Auth#ensureFreshAccount'
export type EnsureFreshResultType = {
  "account": AccountType;

  /*
   * 'fresh'     - the stored Minecraft token is still valid
   * 'refreshed' - a new Minecraft token was obtained'
   * 'failed'    - the stored Minecraft token is stale but fetch failed (allows offline play only)
   */
  "status": "fresh" | "refreshed" | "failed";
};

// Used for building a Minecraft launch command
export type LaunchAuthType = {
  "username": string;
  "token"   : string;
  "uuid"    : string;
  "type"    : string;
  "xuid"    : string;
};
