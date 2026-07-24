<script setup lang="ts">
import { createSkinViewer, use } from "@daidr/minecraft-skin-renderer";
import { WebGLRendererPlugin } from "@daidr/minecraft-skin-renderer/webgl";
import { inject, onMounted, ref, useTemplateRef } from "vue";

import PageWrapper from "@/components/general/layout/PageWrapper.vue";
import { AuthStatesContextKey } from "@/constants/application.ts";
import type { WrappedAccountsType } from "@/types/configs/account.type.ts";

const canvas = useTemplateRef("canvas");

const status = ref<string>("loading");

const accounts = inject<WrappedAccountsType>(AuthStatesContextKey);

onMounted(async () => {
  if (!canvas.value) {
    return;
  }

  use(WebGLRendererPlugin);

  const viewer = await createSkinViewer({
    "canvas": canvas.value,
    "skin"  : "https://textures.minecraft.net/texture/6ac65b1fd2d7b3dbaeeb702fad5932c4117a1e5f7d7db2531662baecdc48923",
    "slim"  : true,
  });

  viewer.startRenderLoop();

  status.value = "done";
});
</script>

<template>
  <PageWrapper>
    {{ accounts }}
    <div id="profile__skin-status">
      {{ status }}
    </div>
    <div id="profile__skin-preview" class="flex">
      <canvas id="profile__skin-canvas" ref="canvas" width="300" height="400" />
    </div>
  </PageWrapper>
</template>
