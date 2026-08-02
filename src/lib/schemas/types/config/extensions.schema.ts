import { Type } from "typebox";

export const ExtensionsSchema = Type.Object({
  "list": Type.Array(
    Type.Object({
      "enabled": Type.Boolean(),
      "sha256" : Type.String(),
    }),
  ),

  /*
   * For some reason, this 'Type#Record' produces two external variables: '[ /^.*$/, /^.*$/ ]',
   * which breaks 'bun generate:validators', so we lighten the checks.
   *
   * ```js
   * Type.Record(
   *   Type.String(),
   *   Type.Record(
   *     Type.String(),
   *     Type.Boolean(),
   *   ),
   * ),
   * ```
   */
  "permissions"               : Type.Any(),
  "enabled"                   : Type.Boolean(),
  "allowUnrestrictedUntrusted": Type.Boolean(),
  "showAppAfterExtensionsLoad": Type.Boolean(),
});
