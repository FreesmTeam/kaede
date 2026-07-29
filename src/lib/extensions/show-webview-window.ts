import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

import { log } from "@/lib/logging/log.ts";

export async function showWebviewWindow(show: boolean | undefined): Promise<void> {
  if (show) {
    log.debug(
      __PRE_BUNDLED_FILENAME__,
      "User has enabled 'show-after-extensions-initialization';",
      "Showing the webview now",
    );
    await getCurrentWebviewWindow().show();

    log.info(
      __PRE_BUNDLED_FILENAME__,
      "Launcher successfully initialized in:",
      performance.now().toFixed(1),
      "ms",
    );
  }
}
