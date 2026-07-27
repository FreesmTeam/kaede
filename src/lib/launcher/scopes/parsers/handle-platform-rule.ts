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

import { unifyPlatformWithArch } from "@/lib/launcher/scopes/parsers/unify-platform-with-arch.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type {
  SpecificPatchLibraryRuleType,
} from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { DeepRequired } from "@/types/utils/deep-required.type.ts";

function isPlatformRuleAllowed({
  platform,
  arch,
  rule,
  current,
}: {
  "platform": PreLaunchInformationType["platform"];
  "arch"    : PreLaunchInformationType["arch"];
  "rule"    : DeepRequired<SpecificPatchLibraryRuleType>;
  "current" : boolean;
}): boolean {
  const {
    "platform": unifiedPlatform,
    "arch"    : unifiedArch,
  } = unifyPlatformWithArch(rule.os.name);
  const isCompatiblePlatform: boolean = unifiedPlatform === platform;

  /*
   * The possible values for OS name are:
   * - 'platform'       <-- means x86_64 or x86 ('unifyPlatformWithArch' returns 'any')
   * - 'platform-arm32' <-- means arm32
   * - 'platform-arm64' <-- means arm64
   */
  const isCompatibleAnyArch: boolean = unifiedArch === "any" && (
    arch === "x64" ||
    arch === "x86"
  );
  const isCompatibleArch: boolean =
    isCompatibleAnyArch ||
    unifiedArch === arch;

  // We care about the rule only if it targets the same platform and arch
  if (!isCompatiblePlatform || !isCompatibleArch) {
    return current;
  }

  return rule.action === "allow";
}

export { isPlatformRuleAllowed as handlePlatformRule };
