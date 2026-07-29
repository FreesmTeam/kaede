import { DefaultLocale } from "@/constants/application.ts";
import EnglishTranslations from "@/constants/english.json";
import FileStructure from "@/constants/file-structure.ts";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import type { ParsedFile } from "@/types/application/parsed-file.type.ts";
import type { TranslationsType } from "@/types/translations/translations.type.ts";

export async function getTranslations(properties?: Partial<{
  "baseDirectory": string;
  "selected"     : string;
  "isDefault"    : boolean;
  "parsedFile"   : ParsedFile;
}>): Promise<TranslationsType> {
  if (properties?.isDefault) {
    return EnglishTranslations;
  }

  const baseDirectory = properties?.baseDirectory ?? General.getCachedBaseDirectory();
  const parsedFile: ParsedFile | undefined = properties?.parsedFile;
  const selected = properties?.selected ?? DefaultLocale;

  const parsedTranslations: unknown = parsedFile?.status === "loaded"
    ? parsedFile.data
    : await General.handleJsonFile({
      baseDirectory,
      "path"           : [FileStructure.Folders.Translations.Path, selected + ".json"],
      "label"          : `/translations/${selected}.json`,
      "getDefaultValue": async (): Promise<TranslationsType> => (EnglishTranslations),
    });

  log.debug(__PRE_BUNDLED_FILENAME__, "Shallowly validating the parsed translations file");

  if (typeof parsedTranslations !== "object" || parsedTranslations === null) {
    log.info(__PRE_BUNDLED_FILENAME__, "The provided translations are invalid");

    return EnglishTranslations;
  }

  /*
   * The parsed translations object is indeed an object;
   * in the worst case a user will just see the 'undefined' values everywhere.
   */
  return parsedTranslations as TranslationsType;
}
