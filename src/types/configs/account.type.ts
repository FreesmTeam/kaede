import type { Static } from "typebox";
import type { ShallowRef } from "vue";

import type { AccountSchema } from "@/lib/schemas/types/accounts";

export type AccountType = Static<typeof AccountSchema>;
export type WrappedAccountsType = ShallowRef<Array<AccountType>, Array<AccountType>>;
