import type { Static } from "typebox";
import { expectTypeOf, test } from "vitest";

import type { AccountSchema } from "@/lib/schemas/scopes/accounts";
import type { ConfigSchema } from "@/lib/schemas/scopes/config";
import type { AccountType } from "@/types/configs/account.type.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";

test("public account and config types stay aligned with their schemas", () => {
  expectTypeOf<AccountType>().toEqualTypeOf<Static<typeof AccountSchema>>();
  expectTypeOf<ConfigType>().toEqualTypeOf<Static<typeof ConfigSchema>>();
});
