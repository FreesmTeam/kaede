import { Host } from "@/lib/capability-broker";

export async function getMissingPaths({
  paths,
}: {
  "paths": Array<string>;
}): Promise<Array<string>> {
  return [...await Host.files.findMissing(paths)];
}
