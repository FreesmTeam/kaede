import { UnsupportedInBrowserPreviewError } from "@/lib/capability-broker/errors.ts";
import type {
  CapabilityBrokerRuntime,
  PluginEventCapabilityFactory,
} from "@/lib/capability-broker/types.ts";

/**
 * Desktop builds deliberately contain no browser capability implementation.
 * The Vite browser adapter alias replaces this module for Pages builds.
 */
export async function createBrowserCapabilityBroker(
  getEventFactory: () => PluginEventCapabilityFactory | undefined,
): Promise<CapabilityBrokerRuntime> {
  void getEventFactory;

  throw new UnsupportedInBrowserPreviewError("browser capability broker in a desktop build");
}
