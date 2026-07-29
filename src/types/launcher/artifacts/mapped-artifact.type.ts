export type MappedArtifactType = {
  "id"       : string;
  "path"     : string;
  "file"     : string;
  "directory": string;
  "url"      : string;
  // 'ignore' is used only when the hash is unknown
  "hash"     : string | "ignore";

  /**
   * 'library' should be both downloaded and included in the classpath
   * 'mavenFile' should be just downloaded
   * 'native' should be downloaded and extracted but not included in the classpath
   * 'empty' should be just included in the classpath
   */
  "status"?: "library" | "mavenFile" | "native" | "empty";

  /**
   * Indicates the '+libraries' field in MultiMC patches.
   *
   * Should be specified the first in classpaths
   */
  "first"?: boolean;

  /**
   * Used when unzipping natives.
   *
   * Taken from 'library.extract.exclude':
   *
   * ```
   * "extract": {
   *   "exclude": [
   *     "META-INF/"
   *   ]
   * },
   * ```
   */
  "exclude"?: Array<string>;
};
