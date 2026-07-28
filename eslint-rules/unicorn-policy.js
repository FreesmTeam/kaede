export default {
  // Keep null where Web APIs and serialization contracts distinguish it from undefined.
  "unicorn/no-null"                      : ["off"],
  // ESNext types do not polyfill these APIs for the declared macOS 10.13 WebView floor.
  "unicorn/prefer-global-this"           : ["off"],
  "unicorn/prefer-at"                    : ["off"],
  "unicorn/no-array-reverse"             : ["off"],
  "unicorn/prefer-string-replace-all"    : ["off"],
  "unicorn/prefer-iterator-helpers"      : ["off"],
  "unicorn/prefer-iterator-to-array"     : ["off"],
  "unicorn/prefer-promise-with-resolvers": ["off"],
  // Top-level await is intentionally excluded from the application bootstrap.
  "unicorn/prefer-top-level-await"       : ["off"],
  // GetElementById is the direct operation for the ID-based lookups used here.
  "unicorn/prefer-query-selector"        : ["off"],
  // Preserve the established plugin-facing General.getCachedPortable() API.
  "unicorn/consistent-boolean-name"      : ["error", { "ignore": ["^getCachedPortable$"] }],
  "unicorn/filename-case"                : ["warn", {
    "cases": {
      "kebabCase" : true,
      "pascalCase": true,
    },
  }],
  "unicorn/name-replacements": ["warn", {
    // Keep full domain terms; this rule replaces the former abbreviation guard.
    "replacements": {
      "application"  : false,
      "applications" : false,
      "configuration": false,
      "repository"   : false,
    },
  }],
};
