import { afterEach, expect, test, vi } from "vitest";
import { createApp } from "vue";

vi.mock("@/components/add-instance/AddInstance.vue", () => ({ "default": {} }));
vi.mock("@/components/add-instance/tabs/CleanInstance.vue", () => ({ "default": {} }));
vi.mock("@/components/general/layout/ContextMenu.vue", () => ({ "default": {} }));
vi.mock("@/components/general/layout/GlobalBackground.vue", () => ({ "default": {} }));
vi.mock("@/components/general/layout/LaunchProgress.vue", () => ({ "default": {} }));
vi.mock("@/components/general/layout/PagesSelector.vue", () => ({ "default": {} }));
vi.mock("@/components/general/layout/Sidebar.vue", () => ({ "default": {} }));

import { C } from "@/extendable/component-registry.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import { SettingsComponents } from "@/extendable/settings-component-registry.ts";
import { registerComponent } from "@/lib/globals/scopes/register-component.ts";

const DefaultLazyPluginPlayground = SettingsComponents.LazyPluginPlayground;

afterEach(() => {
  Reflect.deleteProperty(C, "TrustedComponent");
  C.LazyPluginPlayground = DefaultLazyPluginPlayground;
  GlobalInternals.appInstance = undefined;
});

test("keeps the lazy settings slot replaceable through the public registry", () => {
  const app = createApp({});
  const component = { "template": "<p>replacement playground</p>" };

  GlobalInternals.appInstance = app;
  registerComponent("LazyPluginPlayground", component);

  expect(C.LazyPluginPlayground).toBe(component);
  expect(SettingsComponents.LazyPluginPlayground).toBe(component);
});

test("registers a trusted component on the Vue app and component registry", () => {
  const app = createApp({});
  const component = { "template": "<p>trusted component</p>" };

  GlobalInternals.appInstance = app;
  registerComponent("TrustedComponent", component);

  expect(app.component("TrustedComponent")).toBe(component);
  expect(C.TrustedComponent).toBe(component);
});

test("fails clearly when trusted code registers before app creation", () => {
  GlobalInternals.appInstance = undefined;

  expect(() => registerComponent("TooEarly", {})).toThrow(
    "Cannot register component before the Vue app is created",
  );
});
