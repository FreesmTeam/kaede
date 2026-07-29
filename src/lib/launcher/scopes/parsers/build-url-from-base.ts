import { log } from "@/lib/logging/log.ts";

export function buildUrlFromBase({
  baseUrl,
  name,
  file,
  descriptiveLogPrefix,
}: {
  "baseUrl"             : string;
  "name"                : string;
  "file"                : string;
  "descriptiveLogPrefix": string;
}): string | false {
  /*
   * For some reason, sometimes 'url' fields lack the '/' character at the end of the string
   *
   * Example:
   * {
   *   "name": "net.fabricmc:sponge-mixin:0.17.0+mixin.0.8.7",
   *   "url": "https://maven.fabricmc.net/"
   * },
   * {
   *   "name": "net.fabricmc:fabric-loader:0.18.4",
   *   "url": "https://maven.fabricmc.net"
   * }
   */
  const ensureSlash: string = baseUrl.endsWith("/") ? "" : "/";
  // 'net.fabricmc:fabric-loader:0.18.4'
  const urlPaths: Array<string> = name
    // '["net.fabricmc", "fabric-loader", "0.18.4"]'
    .split(":");
  // 'net.fabricmc'
  const groupPart: string | undefined = urlPaths.shift();

  if (!groupPart) {
    log.warn(descriptiveLogPrefix, "The library name is invalid");

    return false;
  }

  // 'net/fabricmc/fabric-loader/0.18.4'
  const urlPath: string = [
    // 'net/fabricmc'
    groupPart.split(".").join("/"),
    // '["fabric-loader", "0.18.4"]'
    ...urlPaths,
  ].join("/");

  return baseUrl + ensureSlash + urlPath + "/" + file;
}
