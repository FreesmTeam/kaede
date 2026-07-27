import type {
  SpecificPatchClassifiersType,
  SpecificPatchLibraryType,
} from "@/types/launcher/meta/specific-patch-meta.type.ts";

function isNativeLibrary(library: SpecificPatchLibraryType): boolean {
  const name: string | undefined = library?.name;

  if (!name) {
    return false;
  }

  const classifiers: SpecificPatchClassifiersType | undefined = library?.downloads?.classifiers;

  return (
    classifiers !== undefined ||
    name.includes("native")
  );
}

export { isNativeLibrary as checkIsNative };
