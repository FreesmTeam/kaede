import { beforeEach, expect, test, vi } from "vitest";
import {
  createRenderer,
  h,
  nextTick,
  type RendererOptions,
  type VNode,
} from "vue";

import Image from "@/components/general/base/Image.vue";
import {
  createStoredImageReference,
  replaceImageObjectUrl,
} from "@/lib/capability-broker/image-object-url.ts";

const { readBytes } = vi.hoisted(() => ({
  "readBytes": vi.fn<(path: string) => Promise<Uint8Array>>(),
}));

vi.mock("@/lib/capability-broker", () => ({
  "Host": {
    "files": { readBytes },
  },
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

const TestableImage = {
  ...Image,
  "render": (
    _context: unknown,
    _cache: unknown,
    _properties: unknown,
    setup: Readonly<{ "resolvedSource": string }>,
  ): VNode => h("img", { "src": setup.resolvedSource }),
};

beforeEach(() => {
  vi.restoreAllMocks();
  readBytes.mockReset();
  Object.defineProperty(window, "addEventListener", {
    "configurable": true,
    "value"       : vi.fn(),
  });
});

test("updates the mounted img when the same stored path gets new bytes", async () => {
  const path = "/kaede/resources/same-name.png";
  const createObjectUrl = vi.spyOn(URL, "createObjectURL")
    .mockReturnValueOnce("blob:first-image")
    .mockReturnValueOnce("blob:second-image");

  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  readBytes.mockResolvedValue(Uint8Array.of(1));

  const root = createTestNode("root");
  const app = createRenderer<TestNode, TestNode>(rendererOptions).createApp(TestableImage, {
    "id" : "instance-icon",
    "alt": "An instance icon",
    "src": createStoredImageReference(path),
  });

  app.provide(Symbol.for("v-scx"), { "modules": new Set<string> });
  app.mount(root);
  await Promise.resolve();
  await nextTick();

  const image = root.children[0];

  expect(image?.type).toBe("img");
  expect(image?.props.src).toBe("blob:first-image");

  replaceImageObjectUrl(path, Uint8Array.of(2));
  await nextTick();

  expect(image?.props.src).toBe("blob:second-image");
  expect(createObjectUrl).toHaveBeenCalledTimes(2);

  app.unmount();
});
