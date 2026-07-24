import type { BrokerProcess } from "@/lib/capability-broker";

export type LaunchResponseType = {
  "success": boolean;
  "process": BrokerProcess | undefined;
};
