import { afterEach, expect, test, vi } from "vitest";
import { createApp, createSSRApp, defineComponent, h } from "vue";
import { renderToString } from "vue/server-renderer";

type EmptyComponentModule = Readonly<{
  "default": Readonly<{
    "render": () => null;
  }>;
}>;

const emptyComponentFactory = vi.hoisted((): (() => EmptyComponentModule) => {
  return (): EmptyComponentModule => ({
    "default": { "render": (): null => null },
  });
});

vi.mock("@/components/add-instance/AddInstance.vue", emptyComponentFactory);
vi.mock(
  "@/components/add-instance/tabs/CleanInstance.vue",
  emptyComponentFactory,
);
vi.mock(
  "@/components/general/layout/ContextMenu.vue",
  emptyComponentFactory,
);
vi.mock(
  "@/components/general/layout/GlobalBackground.vue",
  emptyComponentFactory,
);
vi.mock(
  "@/components/general/layout/LaunchProgress.vue",
  emptyComponentFactory,
);
vi.mock(
  "@/components/general/layout/PagesSelector.vue",
  emptyComponentFactory,
);
vi.mock(
  "@/components/general/layout/Sidebar.vue",
  emptyComponentFactory,
);

import Router from "@/components/general/layout/Router.vue";
import { C } from "@/extendable/component-registry.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import { registerComponent } from "@/lib/globals/scopes/register-component.ts";

const OriginalGlobalBackground = C.GlobalBackground;
const OriginalPagesSelector = C.PagesSelector;

afterEach(() => {
  C.GlobalBackground = OriginalGlobalBackground;
  C.PagesSelector = OriginalPagesSelector;
  GlobalInternals.appInstance = undefined;
});

test("renders trusted replacements from the public component registry", async () => {
  const background = defineComponent({
    "name" : "ReplacementBackground",
    "setup": () => (): ReturnType<typeof h> => h("div", { "id": "replacement-background" }),
  });
  const pages = defineComponent({
    "name" : "ReplacementPages",
    "setup": () => (): ReturnType<typeof h> => h("main", { "id": "replacement-pages" }),
  });

  GlobalInternals.appInstance = createApp({});
  registerComponent("GlobalBackground", background);
  registerComponent("PagesSelector", pages);

  const markup = await renderToString(createSSRApp(Router, { "page": "home" }));

  expect(markup).toContain("id=\"replacement-background\"");
  expect(markup).toContain("id=\"replacement-pages\"");
});
