import { afterEach, expect, test, vi } from "vitest";
import {
  createRenderer,
  h,
  nextTick,
  type RendererOptions,
  shallowReactive,
  type ShallowRef,
  type VNode,
} from "vue";

import LogViewer from "@/components/logging/LogViewer.vue";
import { InstanceLogsContextKey } from "@/constants/application.ts";
import { globalStates } from "@/states/global.ts";

const { closeViewer, selectMode } = vi.hoisted(() => ({
  "closeViewer": vi.fn(),
  "selectMode" : vi.fn(),
}));

vi.mock("@/composables/use-log-stream.ts", async () => {
  const { shallowRef } = await vi.importActual<typeof import("vue")>("vue");

  return {
    "useLogStream": (): { "lines": ShallowRef<{ "list": Array<string> }> } => ({
      "lines": shallowRef({ "list": ["launcher-line"] }),
    }),
  };
});

vi.mock("@/lib/logging", () => ({
  "default": { closeViewer },
}));

vi.mock("@/lib/global-state-helpers", () => ({
  "default": { "Logs": { selectMode } },
}));

type TestNode = {
  "children": Array<TestNode>;
  "parent"  : TestNode | null;
  "props"   : Record<string, unknown>;
  "text"    : string;
  "type"    : string;
};

function createTestNode(type: string, text = ""): TestNode {
  return { "children": [], "parent": null, "props": {}, text, type };
}

const rendererOptions: RendererOptions<TestNode, TestNode> = {
  "patchProp": (element, key, _previousValue, nextValue): void => {
    element.props[key] = nextValue;
  },
  "insert": (node, parent, anchor): void => {
    node.parent = parent;

    if (anchor === undefined || anchor === null) {
      parent.children.push(node);

      return;
    }

    parent.children.splice(parent.children.indexOf(anchor), 0, node);
  },
  "remove": node => {
    const index = node.parent?.children.indexOf(node) ?? -1;

    if (index >= 0) {
      node.parent?.children.splice(index, 1);
    }

    node.parent = null;
  },
  "createElement": type => createTestNode(type),
  "createText"   : text => createTestNode("text", text),
  "createComment": text => createTestNode("comment", text),
  "setText"      : (node, text): void => {
    node.text = text;
  },
  "setElementText": (node, text): void => {
    node.text = text;
  },
  "parentNode" : node => node.parent,
  "nextSibling": node => {
    const siblings = node.parent?.children;

    if (siblings === undefined) {
      return null;
    }

    return siblings[siblings.indexOf(node) + 1] ?? null;
  },
};

const TestableLogViewer = {
  ...LogViewer,
  "render": (
    _context: unknown,
    _cache: unknown,
    _properties: unknown,
    setup: Readonly<{
      "closeViewer": () => void;
      "filtered"   : Array<string>;
    }>,
  ): VNode => h("section", [
    h("button", { "onClick": setup.closeViewer }, "close"),
    ...setup.filtered.map(line => h("p", line)),
  ]),
};

afterEach(() => {
  closeViewer.mockReset();
  selectMode.mockReset();
  Reflect.deleteProperty(globalStates, "logs");
});

test("closes the overlay and switches from launcher to captured instance logs", async () => {
  Object.assign(globalStates, {
    "logs": {
      "show"       : true,
      "lineBreaks" : true,
      "virtualized": true,
      "mode"       : "launcher",
      "filtering"  : "",
    },
  });
  const root = createTestNode("root");
  const app = createRenderer<TestNode, TestNode>(rendererOptions).createApp(TestableLogViewer);

  app.provide(InstanceLogsContextKey, shallowReactive({
    "instance-one": ["instance-line"],
  }));
  app.provide(Symbol.for("v-scx"), { "modules": (new Set<string>) });
  app.mount(root);
  await nextTick();

  const viewer = root.children.at(0);
  const closeButton = viewer?.children.at(0);
  const onClose = closeButton?.props.onClick as (() => void) | undefined;

  expect(viewer?.children[1]?.text).toBe("launcher-line");
  expect(onClose).toBeTypeOf("function");
  onClose?.();
  expect(closeViewer).toHaveBeenCalledOnce();

  globalStates.logs.mode = "instance-one";
  await nextTick();

  expect(viewer?.children[1]?.text).toBe("instance-line");

  app.unmount();
});

test("normalizes a stale instance mode to launcher when the viewer opens", async () => {
  Object.assign(globalStates, {
    "logs": {
      "show"       : true,
      "lineBreaks" : true,
      "virtualized": true,
      "mode"       : "removed-instance",
      "filtering"  : "",
    },
  });
  const root = createTestNode("root");
  const app = createRenderer<TestNode, TestNode>(rendererOptions).createApp(TestableLogViewer);

  app.provide(InstanceLogsContextKey, shallowReactive({
    "instance-one": ["instance-line"],
  }));
  app.provide(Symbol.for("v-scx"), { "modules": (new Set<string>) });
  app.mount(root);
  await nextTick();

  expect(selectMode).toHaveBeenCalledExactlyOnceWith("launcher");

  app.unmount();
});
