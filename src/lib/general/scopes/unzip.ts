import { Host } from "@/lib/capability-broker";

export async function unzip({
  from,
  to,
}: {
  "from": string;
  "to"  : string;
}): Promise<boolean> {
  await Host.archives.extractZip({
    "archivePath"    : from,
    "destinationPath": to,
  });

  return true;
}
