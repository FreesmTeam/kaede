export type ModrinthSearchHitType = {
  "project_id"   : string;
  "slug"         : string;
  "title"        : string;
  "description"  : string;
  "author"       : string;
  "downloads"    : number;
  "follows"      : number;
  "icon_url"     : string | null;
  "categories"   : Array<string>;
  "versions"     : Array<string>;
  "date_modified": string;
};
export type ModrinthSearchResponseType = {
  "hits"      : Array<ModrinthSearchHitType>;
  "offset"    : number;
  "limit"     : number;
  "total_hits": number;
};
export type ModrinthSearchArgumentsType = {
  "query"       ?: string;
  "gameVersions"?: Array<string>;
  "loaders"     ?: Array<string>;
  "offset"      ?: number;
  "limit"       ?: number;
};
