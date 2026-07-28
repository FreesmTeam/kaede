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

import { handlePlatformRule } from "@/lib/launcher/scopes/parsers/handle-platform-rule.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type {
  SpecificPatchLibraryOSNameType,
  SpecificPatchLibraryRuleType,
  SpecificPatchLibraryType,
} from "@/types/launcher/meta/specific-patch-meta.type.ts";

export function shouldIncludeLibrary({
  necessaries,
  library,
}: {
  "necessaries": PreLaunchInformationType;
  "library"    : SpecificPatchLibraryType;
}): boolean {
  if (
    library?.rules === undefined ||
    !Array.isArray(library.rules)
  ) {
    return true;
  }

  const { platform, arch } = necessaries;
  const rules: Array<SpecificPatchLibraryRuleType> = library.rules;
  let shouldInclude: boolean = false;

  for (const rule of rules) {
    const parsedOS: SpecificPatchLibraryOSNameType | undefined = rule?.os?.name;

    if (parsedOS === undefined) {
      shouldInclude = rule?.action === "allow";

      continue;
    }

    shouldInclude = handlePlatformRule({
      "rule": {
        "action": rule?.action ?? "allow",
        "os"    : {
          "name": parsedOS,
        },
      },
      "current": shouldInclude,
      platform,
      arch,
    });
  }

  return shouldInclude;
}
