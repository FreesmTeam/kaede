import { getName, getTauriVersion, getVersion } from "@tauri-apps/api/app";
import { join, normalize } from "@tauri-apps/api/path";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

import type { DirectHostFacade } from "@/lib/capability-broker/types.ts";

export function createDesktopDirectHostFacade(): DirectHostFacade {
  return Object.freeze({
    "app": Object.freeze({
      "name"        : getName,
      "version"     : getVersion,
      "tauriVersion": getTauriVersion,
    }),
    "path": Object.freeze({
      "join": (...parts: ReadonlyArray<string>): Promise<string> => join(...parts),
      normalize,
    }),
    "showMainWebview": async (): Promise<void> => {
      const webview = getCurrentWebviewWindow();

      if (webview.label !== "main") {
        throw new Error(`Expected main WebView, received ${JSON.stringify(webview.label)}`);
      }

      await webview.show();
    },
  });
}
