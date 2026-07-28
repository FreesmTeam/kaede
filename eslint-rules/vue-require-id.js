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

const requireIDRule = {
  "meta": {
    "type"  : "suggestion",
    "schema": [{
      "type"      : "object",
      "properties": {
        "elements": {
          "type"       : "array",
          "items"      : { "type": "string" },
          "uniqueItems": true,
        },
      },
      "additionalProperties": false,
    }],
    "messages": {
      "missingId": "Missing \"id\" attribute in <{{element}}>",
    },
  },
  create(context) {
    const elements = context.options[0]?.elements ?? ["input", "button"];
    const { defineTemplateBodyVisitor } = context.sourceCode.parserServices;

    if (typeof defineTemplateBodyVisitor !== "function") return {};

    return defineTemplateBodyVisitor({
      VElement(node) {
        if (!elements.includes(node.rawName)) return;

        const hasID = node.startTag.attributes.some(attribute => {
          const { argument, name } = attribute.key;

          return name === "id" || (name?.rawName === ":" && argument?.rawName === "id");
        });

        if (!hasID) {
          context.report({
            "node"     : node,
            "messageId": "missingId",
            "data"     : { "element": node.rawName },
          });
        }
      },
    });
  },
};

export default {
  "rules": {
    "require-id": requireIDRule,
  },
};
