export type ParsedFile =
  // For a well-formed JSON
  | { "status": "loaded"; "data": unknown }

  /*
   * The file is empty or does not exist.
   * It will be rewritten with default contents
   */
  | { "status": "missing" }

  /*
   * The file exists and is not empty, but has invalid JSON.
   * It will be backed up and a new file with default contents will be created
   */
  | { "status": "corrupt"; "raw": string; "error": string };
