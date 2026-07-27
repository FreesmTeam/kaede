import { LogInfo } from "@/constants/browser.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import { normalizeBrowserPath } from "@/lib/browser/scopes/browser-preview-paths.ts";
import type { BrowserStorage } from "@/lib/browser/scopes/browser-storage.ts";
import type { DownloadProgress } from "@/lib/capability-broker/types.ts";

export async function pickBrowserIcon(
  allowedExtensions: ReadonlyArray<string>,
): Promise<File | null> {
  const input = document.createElement("input");

  input.type = "file";
  input.accept = allowedExtensions.map(extension => `.${extension}`).join(",");

  return new Promise(resolve => {
    let isSettled = false;
    const finish = (file: File | null): void => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      input.remove();
      resolve(file);
    };

    input.addEventListener("change", (): void => finish(input.files?.item(0) ?? null), {
      "once": true,
    });
    window.addEventListener("focus", (): void => {
      setTimeout((): void => finish(input.files?.item(0) ?? null), 0);
    }, { "once": true });
    input.click();
  });
}

export function logInBrowser(
  level: "debug" | "info" | "warn" | "error",
  message: string,
  location: string,
): void {
  const now = new Date;
  const time = [
    now.getHours().toString(),
    now.getMinutes().toString()
      .padStart(2, "0"),
    now.getSeconds().toString()
      .padStart(2, "0"),
    now.getMilliseconds().toString()
      .padStart(3, "0"),
  ].join(":");
  const numericLevel = ({ "debug": 2, "info": 3, "warn": 4, "error": 5 } as const)[level];
  const formatted = [
    time,
    LogInfo.levels[numericLevel],
    `webview:${location}`,
    message,
  ].join(LogInfo.delimiter);

  GlobalInternals.logsInBrowser.push(formatted);
}

export async function downloadToBrowserStorage(
  storage: BrowserStorage,
  url: string,
  destinationPath: string,
  onProgress: (progress: DownloadProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  const requestInit: RequestInit = signal === undefined
    ? { "credentials": "omit" }
    : { "credentials": "omit", signal };
  const response = await fetch(url, requestInit);

  if (!response.ok) {
    throw new Error(`HTTP download returned status ${response.status} ${response.statusText}`);
  }

  const totalHeader = response.headers.get("content-length");
  const total = totalHeader === null ? null : Number(totalHeader);
  const started = performance.now();
  let transferred = 0;
  let bytes: Uint8Array;

  if (response.body === null) {
    bytes = new Uint8Array(await response.arrayBuffer());
    transferred = bytes.byteLength;
    onProgress({ "transferred": transferred, total, "bytesPerSecond": transferred });
  } else {
    const reader = response.body.getReader();
    const chunks: Array<Uint8Array> = [];

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      chunks.push(value);
      transferred += value.byteLength;
      const seconds = Math.max((performance.now() - started) / 1000, Number.EPSILON);

      onProgress({
        transferred,
        total,
        "bytesPerSecond": Math.round(transferred / seconds),
      });
    }

    bytes = new Uint8Array(transferred);
    let offset = 0;

    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
  }

  signal?.throwIfAborted();
  await storage.write(normalizeBrowserPath(destinationPath), bytes);
}
