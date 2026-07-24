import { expect, expectTypeOf, test } from "vitest";

import EnglishTranslations from "@/constants/english.json";
import {
  TRANSLATION_KEYS,
  type TranslationInfoType,
  type TranslationKey,
  type TranslationsType,
} from "@/types/translations/translations.type.ts";

test("the public translation contract stays synchronized with English", () => {
  expectTypeOf(EnglishTranslations).toMatchTypeOf<TranslationsType>();
  expectTypeOf<keyof typeof EnglishTranslations.Info>()
    .toEqualTypeOf<keyof TranslationInfoType>();
  expectTypeOf<keyof typeof EnglishTranslations.Messages>().toEqualTypeOf<TranslationKey>();

  expect(Object.keys(EnglishTranslations.Info)).toEqual(["Code", "Name", "Flag", "RTL"]);
  expect(Object.keys(EnglishTranslations.Messages)).toEqual(TRANSLATION_KEYS);
});
