import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type {
  SpecificPatchClassifierKeyType,
  SpecificPatchClassifierOSType,
  SpecificPatchLibraryOSNameType,
  SpecificPatchRuntimeOSType,
} from "@/types/launcher/meta/specific-patch-meta.type.ts";

/**
 * MultiMC meta server returns *four* different naming schemes:
 *
 * - 'natives-%platform%-%arch%'
 * - '%platform%-%arch%'
 * - '%differently-formatted-platform%-%arch%'
 * - '%differently-formatted-platform%-%differently-formatted-arch%'
 *
 * This function unifies the platform and arch name.
 */
export function unifyPlatformWithArch(
  name:
    SpecificPatchLibraryOSNameType |
    SpecificPatchRuntimeOSType |
    SpecificPatchClassifierKeyType |
    // These values are stored in the artifact name in new minecraft versions
    SpecificPatchClassifierOSType,
): {
  "platform": PreLaunchInformationType["platform"];
  "arch"    : PreLaunchInformationType["arch"] | "any";
} {
  switch (name) {
    // 'SpecificPatchLibraryOSNameType | SpecificPatchRuntimeOSType'
    case "linux": {
      return { "platform": "linux", "arch": "any" };
    }
    case "linux-arm32": {
      return { "platform": "linux", "arch": "arm32" };
    }
    case "linux-riscv64":
    case "linux-arm64": {
      return { "platform": "linux", "arch": "arm64" };
    }
    case "linux-x64": {
      return { "platform": "linux", "arch": "x64" };
    }
    case "windows": {
      return { "platform": "windows", "arch": "any" };
    }
    case "windows-arm32": {
      return { "platform": "windows", "arch": "arm32" };
    }
    case "windows-arm64": {
      return { "platform": "windows", "arch": "arm64" };
    }
    case "windows-x64": {
      return { "platform": "windows", "arch": "x64" };
    }
    case "osx": {
      return { "platform": "macos", "arch": "any" };
    }
    case "osx-arm64": {
      return { "platform": "macos", "arch": "arm64" };
    }
    case "mac-os-arm64": {
      return { "platform": "macos", "arch": "arm64" };
    }
    case "mac-os-x64": {
      return { "platform": "macos", "arch": "x64" };
    }
    // 'SpecificPatchClassifierKeyType'
    case "natives-linux": {
      return { "platform": "linux", "arch": "any" };
    }
    case "natives-linux-${arch}": {
      return { "platform": "linux", "arch": "any" };
    }
    case "natives-linux-arm32": {
      return { "platform": "linux", "arch": "arm32" };
    }
    case "natives-linux-arm64": {
      return { "platform": "linux", "arch": "arm64" };
    }
    case "natives-osx": {
      return { "platform": "macos", "arch": "any" };
    }
    case "natives-osx-${arch}": {
      return { "platform": "macos", "arch": "any" };
    }
    case "natives-osx-arm64": {
      return { "platform": "macos", "arch": "arm64" };
    }
    case "natives-windows": {
      return { "platform": "windows", "arch": "any" };
    }
    case "natives-windows-${arch}": {
      return { "platform": "windows", "arch": "any" };
    }
    case "natives-macos": {
      return { "platform": "macos", "arch": "any" };
    }
    case "natives-macos-${arch}": {
      return { "platform": "macos", "arch": "any" };
    }
    case "natives-macos-arm64": {
      return { "platform": "macos", "arch": "arm64" };
    }
    // 'SpecificPatchClassifierOSType'
    case "windows-aarch_64": {
      return { "platform": "windows", "arch": "arm64" };
    }
    case "windows-x86_64": {
      return { "platform": "windows", "arch": "x64" };
    }
    case "linux-aarch_64": {
      return { "platform": "linux", "arch": "arm64" };
    }
    case "linux-x86_64": {
      return { "platform": "linux", "arch": "x64" };
    }
    case "osx-aarch_64": {
      return { "platform": "macos", "arch": "arm64" };
    }
    case "osx-x86_64": {
      return { "platform": "macos", "arch": "x64" };
    }
    // Insane shit that I have discovered when tried to download 1.7.10
    case "natives-windows-32": {
      return { "platform": "windows", "arch": "x86" };
    }
    // Made up by me; may not exist
    case "natives-windows-arm32": {
      return { "platform": "windows", "arch": "arm32" };
    }
    case "natives-windows-arm64": {
      return { "platform": "windows", "arch": "arm64" };
    }
    case "natives-windows-x86": {
      return { "platform": "windows", "arch": "x86" };
    }
    case "natives-windows-64":
    case "natives-windows-x64":
    case "natives-windows-x86_64": {
      return { "platform": "windows", "arch": "x64" };
    }
    case "natives-linux-32":
    case "natives-linux-x86": {
      return { "platform": "linux", "arch": "x86" };
    }
    case "natives-linux-64":
    case "natives-linux-x64":
    case "natives-linux-x86_64": {
      return { "platform": "linux", "arch": "x64" };
    }
    case "natives-osx-32":
    case "natives-osx-x86":
    case "natives-macos-32":
    case "natives-macos-x86": {
      return { "platform": "macos", "arch": "x86" };
    }
    case "natives-osx-64":
    case "natives-osx-x64":
    case "natives-osx-x86_64":
    case "natives-macos-64":
    case "natives-macos-x64":
    case "natives-macos-x86_64": {
      return { "platform": "macos", "arch": "x64" };
    }
    default: {
      throw new Error(`Unhandled platform format: ${JSON.stringify(name)}`);
    }
  }
}
