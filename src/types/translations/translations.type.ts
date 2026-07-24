import type { ComputedRef } from "vue";

export const TRANSLATION_KEYS = [
  "general.errors.global-error.emoji",
  "general.errors.global-error.message",
  "general.errors.page-error.message",
  "general.sidebar.add-instance",
  "general.sidebar.home",
  "general.sidebar.library",
  "general.sidebar.settings",
  "general.sidebar.profile",
  "general.sidebar.none",
  "general.launch-status.general-pending-starting",
  "general.launch-status.general-aborted",
  "general.launch-status.general-success",
  "general.launch-status.patch-index-pending-reading",
  "general.launch-status.patch-index-pending-fetching",
  "general.launch-status.patch-index-error-fetch",
  "general.launch-status.patch-index-error-parse",
  "general.launch-status.patch-index-error-validation",
  "general.launch-status.patch-index-success",
  "general.launch-status.patch-metadata-pending-reading",
  "general.launch-status.patch-metadata-pending-fetching",
  "general.launch-status.patch-metadata-error-fetch",
  "general.launch-status.patch-metadata-error-parse",
  "general.launch-status.patch-metadata-error-validation",
  "general.launch-status.patch-metadata-success",
  "general.launch-status.asset-index-pending-reading",
  "general.launch-status.asset-index-pending-fetching",
  "general.launch-status.asset-index-error-get",
  "general.launch-status.asset-index-error-fetch",
  "general.launch-status.asset-index-error-parse",
  "general.launch-status.asset-index-error-validation",
  "general.launch-status.asset-index-success",
  "general.launch-status.asset-objects-success",
  "general.launch-status.libraries-error-validation",
  "general.launch-status.libraries-success",
  "general.launch-status.logging-checking",
  "general.launch-status.logging-error-parse",
  "general.launch-status.logging-success",
  "general.launch-status.client-checking",
  "general.launch-status.client-error-parse",
  "general.launch-status.client-success",
  "general.launch-status.errors-unhandled-error",
  "general.launch-status.errors-incompatible-platform",
  "general.launch-status.errors-incompatible-arch",
  "home.instance.current-playtime.label",
  "home.instance.last-launch.label",
] as const;

export type TranslationKey = (typeof TRANSLATION_KEYS)[number];

export type TranslationInfoType = {
  "Code": string;
  "Name": string;
  "Flag": string;
  "RTL" : boolean;
};

export type TranslationsType = {
  "Info"    : TranslationInfoType;
  "Messages": Record<TranslationKey, string>;
};

export type TranslationsStateType = ComputedRef<TranslationsType>;
