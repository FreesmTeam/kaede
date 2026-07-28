import { readFileSync } from "node:fs";

import {
  type ElementNode,
  NodeTypes,
  type RootNode,
} from "@vue/compiler-core";
import { parse as parseTemplate } from "@vue/compiler-dom";
import { parse as parseComponent } from "@vue/compiler-sfc";
import { expect, test } from "vitest";

function readTemplate(filePath: string): RootNode {
  const source = readFileSync(filePath, "utf8");
  const { descriptor, errors } = parseComponent(source, { "filename": filePath });

  expect(errors).toEqual([]);

  const template = descriptor.template;

  if (template === null) {
    throw new TypeError(`Expected '${filePath}' to contain a template`);
  }

  return parseTemplate(template.content);
}

function findElements(root: ElementNode | RootNode, tag: string): Array<ElementNode> {
  const matches: Array<ElementNode> = [];

  for (const child of root.children) {
    if (child.type !== NodeTypes.ELEMENT) {
      continue;
    }

    if (child.tag === tag) {
      matches.push(child);
    }

    matches.push(...findElements(child, tag));
  }

  return matches;
}

test("keeps process context above the standard and custom layout switch", () => {
  const appTemplate = readTemplate("src/App.vue");
  const layoutTemplate = readTemplate("src/components/general/layout/Layout.vue");
  const providers = findElements(appTemplate, "ContextProviders");

  expect(providers).toHaveLength(1);

  const provider = providers[0];

  if (provider === undefined) {
    throw new TypeError("Expected one process context provider");
  }

  expect(provider.props).not.toEqual(expect.arrayContaining([
    expect.objectContaining({ "type": NodeTypes.DIRECTIVE, "name": "if" }),
  ]));
  expect(findElements(provider, "ErrorBoundary")).toHaveLength(2);
  expect(findElements(provider, "Layout")).toHaveLength(1);
  expect(findElements(provider, "CustomLayout")).toHaveLength(1);
  expect(findElements(layoutTemplate, "ContextProviders")).toEqual([]);
});
