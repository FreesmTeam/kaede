import { Host } from "@/lib/capability-broker";

export async function getSha1Mismatches({
  paths,
}: {
  "paths": Array<{ "path": string; "hash": string }>;
}): Promise<Array<string>> {
  return [...await Host.files.verifySha1(paths)];
}
