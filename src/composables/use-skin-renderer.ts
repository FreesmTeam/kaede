/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { createSkinViewer, type SkinViewer, use } from "@daidr/minecraft-skin-renderer";
import { renderAvatar } from "@daidr/minecraft-skin-renderer/canvas2d";
import { WebGLRendererPlugin } from "@daidr/minecraft-skin-renderer/webgl";
import {
  computed, type ComputedRef, inject,
  onMounted, onUnmounted, type Ref,
  ref, type ShallowRef, shallowRef,
  type TemplateRef, useTemplateRef,
  watchEffect,
} from "vue";

import { AuthStatesContextKey } from "@/constants/application.ts";
import Errors from "@/lib/errors";
import { log } from "@/lib/logging/log.ts";
// The Steve that is shown when there are no accounts or the selected account has no skins
import FallbackSteve from "@/resources/steve_classic.png";
import { globalStates } from "@/states/global.ts";
import type { AccountType, WrappedAccountsType } from "@/types/configs/account.type.ts";

function getSkinSource(account: AccountType): string | Blob {
  if (account.skin.data.length > 0) {
    const decoded: string = atob(account.skin.data);
    const bytes: Uint8Array = Uint8Array.from(decoded, character => (
      character.codePointAt(0) ?? 0
    ));

    return new Blob([bytes], { "type": "image/png" });
  }

  if (account.skin.url.length > 0) {
    return account.skin.url;
  }

  return FallbackSteve;
}

let cleanPreviousViewer = (): void => {};

export function useSkinRenderer({
  render,
  account,
}: {
  "render"  : "3d" | "2d-head";
  "account"?: ComputedRef<AccountType | undefined>;
}): {
  "canvas": TemplateRef<HTMLCanvasElement>;
  "shown" : Ref<boolean>;
  // 'viewer' is undefined for '2d-head'
  "viewer": ShallowRef<SkinViewer | undefined>;
} {
  const accounts = inject<WrappedAccountsType>(AuthStatesContextKey);

  const data = computed((): {
    "url" : string | Blob;
    "slim": boolean;
  } => {
    const index: number = globalStates.selected.account;
    const found: AccountType | undefined = account?.value
      ?? accounts?.value?.[index];

    if (!found) {
      return {
        "url" : FallbackSteve,
        "slim": false,
      };
    }

    return {
      "url" : getSkinSource(found),
      "slim": found.skin.variant === "slim",
    };
  });

  const canvas = useTemplateRef<HTMLCanvasElement>("canvas");
  const shown = ref<boolean>(false);
  const viewer = shallowRef<SkinViewer | undefined>();

  onMounted(async (): Promise<void> => {
    cleanPreviousViewer();

    if (!canvas.value) {
      return log.error(
        __PRE_BUNDLED_FILENAME__,
        "Could not find the canvas to render the skin to",
      );
    }

    try {
      if (render === "3d") {
        use(WebGLRendererPlugin);

        viewer.value = await createSkinViewer({
          "canvas": canvas.value,
          "skin"  : data.value.url,
          "slim"  : data.value.slim,
          "zoom"  : 35,
        });

        viewer.value.startRenderLoop();
      } else {
        await renderAvatar(canvas.value, {
          "skin" : data.value.url,
          "scale": 4,
        });
      }

      shown.value = true;
    } catch (error: unknown) {
      log.error(
        __PRE_BUNDLED_FILENAME__,
        `Error while rendering the '${render}' skin:`,
        Errors.prettify(error),
      );
    }
  });
  onUnmounted(() => {
    if (!viewer.value) {
      return;
    }

    /*
     * Nothing works: making canvas invisible in 'onBeforeUnmount',
     * chaining 'nextTick' for 'viewer.value.dispose()' to run it really late,
     * removing transitions and lowering opacity to 0, removing the element itself,
     * or even doing everything in combination. It's always a white screen flashing.
     *
     * I don't want to resort to 'setTimeout' shit lol, so we simply dispose the previous
     * viewer on the next viewer render
     */
    const floatingViewer = viewer.value;

    cleanPreviousViewer = (): void => {
      log.debug(
        __PRE_BUNDLED_FILENAME__,
        "Disposing the previous viewer that is currently floating with no purpose...",
      );
      floatingViewer.dispose();
      log.debug(
        __PRE_BUNDLED_FILENAME__,
        "Successfully disposed the previous viewer",
      );
    };

    viewer.value = undefined;
  });

  watchEffect(async (onCleanup): Promise<void> => {
    let stale: boolean = false;

    onCleanup(() => {
      stale = true;
    });

    if (render === "2d-head") {
      if (!canvas.value) {
        return log.error(
          __PRE_BUNDLED_FILENAME__,
          "Could not find the canvas to re-render the avatar to",
        );
      }

      try {
        await renderAvatar(canvas.value, {
          "skin" : data.value.url,
          "scale": 4,
        });
      } catch (error: unknown) {
        log.error(
          __PRE_BUNDLED_FILENAME__,
          `Error while rendering the '${render}' skin:`,
          Errors.prettify(error),
        );
      }

      return;
    }

    if (!viewer.value) {
      return;
    }

    /*
     * I can imagine how 'SkinViewer#setSkin' may take enough time for user
     * to be able to switch the account, leading to another 'watchEffect' re-run
     * which will result in a clash between different 'viewer.value' reference 'setSlim' calls.
     *
     * I might be stupid though.
     *
     * UPD: wait, using 'onCleanup' and 'stale' we can mitigate that
     */
    const currentViewer = viewer.value;

    try {
      await currentViewer.setSkin(data.value.url);

      if (stale) {
        return;
      }

      currentViewer.setSlim(data.value.slim);
    } catch (error: unknown) {
      log.error(
        __PRE_BUNDLED_FILENAME__,
        "Error while applying the new skin to the 3D viewer",
        Errors.prettify(error),
      );
    }
  }, { "flush": "post" });

  return { canvas, shown, viewer };
}