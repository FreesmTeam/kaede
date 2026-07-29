import { capitalize } from "@/lib/general/scopes/capitalize.ts";
import { checkDaysDifference } from "@/lib/general/scopes/check-days-difference.ts";
import { gcd } from "@/lib/general/scopes/gcd.ts";
import { getRelativeDate } from "@/lib/general/scopes/get-relative-date.ts";

export default {
  capitalize,
  checkDaysDifference,
  gcd,
  getRelativeDate,
} as const;
