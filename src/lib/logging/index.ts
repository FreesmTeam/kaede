import { log } from "@/lib/logging/log.ts";
import { getLogLevelColor } from "@/lib/logging/scopes/get-log-level-color.ts";
import { getLogTargetColor } from "@/lib/logging/scopes/get-log-target-color.ts";
import {
  handleVirtualListTextSelection,
} from "@/lib/logging/scopes/handle-virtual-list-text-selection.ts";
import { handleVirtualTextCopy } from "@/lib/logging/scopes/handle-virtual-text-copy.ts";
import { selectAllText } from "@/lib/logging/scopes/select-all-text.ts";
import { stopStreamingLogs } from "@/lib/logging/stop-streaming-logs.ts";
import { streamLogs } from "@/lib/logging/stream-logs.ts";

export default {
  streamLogs,
  stopStreamingLogs,
  getLogLevelColor,
  getLogTargetColor,
  handleVirtualListTextSelection,
  handleVirtualTextCopy,
  selectAllText,

  /* 'log' is used separately */
  log,
} as const;
