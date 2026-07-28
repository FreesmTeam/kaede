/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import { effect, isReactive } from "vue";

const getFromConfig = vi.fn();

vi.mock("@/lib/global-state-helpers", () => ({
  "default": { getFromConfig },
}));

describe("global state reactivity", () => {
  beforeEach(() => {
    vi.resetModules();
    getFromConfig.mockReset();
  });

  test("tracks nested layout mutations", async () => {
    getFromConfig.mockReturnValue({
      "layout": {
        "background": { "color": "#000000" },
      },
    });

    const states = await import("./global.ts");

    states.declareGlobalStates();

    const observed: Array<string | null> = [];

    effect(() => {
      observed.push(states.globalStates.layout.background.color);
    });

    states.globalStates.layout.background.color = "#ffffff";

    expect(isReactive(states.globalStates)).toBe(true);
    expect(isReactive(states.globalStates.layout)).toBe(true);
    expect(observed).toStrictEqual(["#000000", "#ffffff"]);
  });
});
