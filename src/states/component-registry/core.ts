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

import { type Component, shallowReactive } from "vue";

type Registry = Record<string, Component>;
type RegistryKey = "global" | "accounts" | "home" | "library" | "settings" | "add-instance";

const registries = new Map<RegistryKey, Registry>;
const overridden = new Set<string>;

export function getRegistry(namespace: RegistryKey): Registry {
  let registry = registries.get(namespace);

  if (!registry) {
    registry = shallowReactive<Registry>({});

    registries.set(namespace, registry);
  }

  return registry;
}

export function __registerComponent(
  namespace: RegistryKey,
  name: string,
  component: Component,
): void {
  overridden.add(`${namespace}:${name}`);

  const registry: Registry = getRegistry(namespace);

  registry[name] = component;
}

export function defineRegistry<T extends Registry>(
  namespace: RegistryKey,
  defaults: T,
): T {
  const registry: Registry = getRegistry(namespace);

  for (const [name, component] of Object.entries(defaults)) {
    if (!overridden.has(`${namespace}:${name}`)) {
      registry[name] = component;
    }
  }

  return registry as T;
}
