<script setup lang="ts">
import { computed } from "vue";

import InstanceGroup from "@/components/library/InstanceGroup.vue";
import { C } from "@/extendable/component-registry.ts";
import { instanceStates } from "@/states/instance.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";

const noneGroup = "__kaede-none";

const groups = computed((): Array<{
  "id"       : string;
  "instances": Array<[string, InstanceStateType]>;
}> => {
  const map = new Map<string, Array<string>>;

  for (const [instanceId, instance] of Object.entries(instanceStates)) {
    if (instance.groups.length <= 0) {
      const current = map.get(noneGroup) ?? [];

      current.push(instanceId);
      map.set(noneGroup, current);

      continue;
    }

    for (const group of instance.groups) {
      const current = map.get(group) ?? [];

      current.push(instanceId);
      map.set(group, current);
    }
  }

  const data = [];

  for (const [group, instanceIds] of map.entries()) {
    const instances: Array<[string, InstanceStateType]> = instanceIds
      .map(instanceId => [instanceId, instanceStates[instanceId]]);

    data.push({
      "id"       : group,
      "instances": instances,
    });
  }

  // Put the 'None' group last
  return data.sort((a, b) => {
    if (a.id === noneGroup) {
      return 1;
    }

    if (b.id === noneGroup) {
      return -1;
    }

    return a.id.localeCompare(b.id);
  });
});
</script>

<template>
  <C.PageWrapper>
    <div
      id="__library-page__wrapper"
      class="h-fit w-full flex flex-col gap-2 py-2 pr-2"
    >
      <InstanceGroup
        v-for="group in groups"
        :key="group.id"
        :id-root="`__library-page__group-${group.id}`"
        :group="group"
      />
    </div>
  </C.PageWrapper>
</template>
