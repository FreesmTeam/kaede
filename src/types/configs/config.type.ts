import type { Static } from "typebox";

import type { ConfigSchema } from "@/lib/schemas/types/config";

export type ConfigType = Static<typeof ConfigSchema>;
