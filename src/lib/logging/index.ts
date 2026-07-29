import { log } from "@/lib/logging/log.ts";
import { getLogEntryInformation } from "@/lib/logging/scopes/get-log-entry-information.ts";
import { getLogFieldText } from "@/lib/logging/scopes/get-log-field-text.ts";
import { getLogLevelColor } from "@/lib/logging/scopes/get-log-level-color.ts";
import { getLogTargetColor } from "@/lib/logging/scopes/get-log-target-color.ts";
import {
  handleVirtualListTextSelection,
} from "@/lib/logging/scopes/handle-virtual-list-text-selection.ts";
import { handleVirtualTextCopy } from "@/lib/logging/scopes/handle-virtual-text-copy.ts";
import { selectAllText } from "@/lib/logging/scopes/select-all-text.ts";

export default {
  getLogEntryInformation,
  getLogFieldText,
  getLogLevelColor,
  getLogTargetColor,
  handleVirtualListTextSelection,
  handleVirtualTextCopy,
  selectAllText,

  /* 'log' is used separately */
  log,
} as const;
