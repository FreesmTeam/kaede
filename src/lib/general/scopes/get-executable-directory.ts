import { Host } from "@/lib/capability-broker";

export async function getExecutableDirectory(): Promise<string> {
  const snapshot = await Host.runtime.getSnapshot();

  return snapshot.executableDirectory;
}
