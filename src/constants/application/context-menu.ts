import FileStructure from "@/constants/file-structure.ts";
import { GlobalObject } from "@/extendable/global-object.ts";
import { Host } from "@/lib/capability-broker";
import Errors from "@/lib/errors";
import { log } from "@/lib/logging/scopes/log.ts";

export const ContextMenuItems = [
  {
    "name"  : "Restart UI",
    "icon"  : "i-lucide-rotate-ccw",
    "action": (): void => window.location.reload(),
  },
  {
    "name"  : "Show Logs",
    "icon"  : "i-lucide-bug",
    "action": (): void => {
      GlobalObject.libs.GlobalStateHelpers.Logs.toggle("show", true);
      GlobalObject.libs.ContextMenu.close();
    },
  },
  {
    "name"  : "Open Root Folder",
    "icon"  : "i-lucide-folder",
    "action": async (): Promise<void> => {
      const baseDirectory: string = GlobalObject.libs.General.getCachedBaseDirectory();

      GlobalObject.libs.ContextMenu.close();
      try {
        await Host.opener.revealItem(
          GlobalObject.libs.General.cachedJoin(
            baseDirectory,
            FileStructure.Files.Config,
          ),
        );
      } catch (error: unknown) {
        log.error(
          __PRE_BUNDLED_FILENAME__,
          "Failed to reveal the config file in the explorer:",
          Errors.prettify(error),
        );

        try {
          await Host.opener.revealItem(
            GlobalObject.libs.General.cachedJoin(baseDirectory),
          );
        } catch (revealError: unknown) {
          log.error(
            __PRE_BUNDLED_FILENAME__,
            "Failed to reveal the root directory in the explorer:",
            Errors.prettify(revealError),
          );
        }
      }
    },
  },
  {
    "name"  : "Open Instance Folder",
    "icon"  : "i-lucide-box",
    "action": async (): Promise<void> => {
      const currentInstanceId: string | null =
        GlobalObject.libs.GlobalStateHelpers.get().layout.currentInstance;
      const baseDirectory: string = GlobalObject.libs.General.getCachedBaseDirectory();

      GlobalObject.libs.ContextMenu.close();

      if (!currentInstanceId) {
        log.warn("No instance selected; revealing the root directory in explorer");
        try {
          await Host.opener.revealItem(
            GlobalObject.libs.General.cachedJoin(
              baseDirectory,
              FileStructure.Folders.Instances.Path,
            ),
          );
        } catch (error: unknown) {
          log.error(
            __PRE_BUNDLED_FILENAME__,
            "Failed to reveal the root directory in the explorer:",
            Errors.prettify(error),
          );
        }

        return;
      }

      const minecraftDirectory: string = GlobalObject.libs.Instances.getMinecraftDirectory({
        "baseDirectory": baseDirectory,
        "instanceId"   : currentInstanceId,
      });

      try {
        await Host.opener.revealItem(
          GlobalObject.libs.General.cachedJoin(minecraftDirectory),
        );
      } catch (error: unknown) {
        log.error(
          __PRE_BUNDLED_FILENAME__,
          "Failed to reveal the instance directory in the explorer:",
          Errors.prettify(error),
        );
      }
    },
  },
] as const;
