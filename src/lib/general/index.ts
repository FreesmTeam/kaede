import { capitalize } from "@/lib/general/scopes/capitalize.ts";
import { checkDaysDifference } from "@/lib/general/scopes/check-days-difference.ts";
import { isFontSourceUrl } from "@/lib/general/scopes/fonts.ts";
import { gcd } from "@/lib/general/scopes/gcd.ts";
import { getRelativeDate } from "@/lib/general/scopes/get-relative-date.ts";

export default {
  capitalize,
  checkDaysDifference,
  isFontSourceUrl,
  gcd,
  getRelativeDate,
} as const;
