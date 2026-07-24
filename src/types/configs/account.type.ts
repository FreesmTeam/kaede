import type { Ref } from "vue";

export type AccountType = {
  "msa": {
    "token"       : string;
    "refreshToken": string;
  } | null;
  "profile": {
    "uuid": string;
    "name": string;
    "type": "msa" | "offline";
  };
  "skin": {
    "id"     : string;
    "data"   : string;
    "url"    : string;
    "variant": "classic" | "slim";
  };
};
export type WrappedAccountsType = Ref<Array<AccountType>, Array<AccountType>>;
