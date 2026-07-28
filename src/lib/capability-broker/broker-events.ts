import type * as DownloadContract from "@/lib/capability-broker/download-contract.ts";

export type RawBrokerEvent =
  | Readonly<{ "kind": "stdout" | "stderr"; "handle": string; "bytes": ReadonlyArray<number> }>
  | Readonly<{
    "kind"  : "terminated";
    "handle": string;
    "code"  : number | null;
    "signal": number | null;
  }>
  | Readonly<{ "kind": "error"; "handle": string; "message": string }>
  | Readonly<{ "kind": "failed"; "handle": string; "message": string }>
  | Readonly<{
    "kind"          : "download_progress";
    "transferred"   : number;
    "total"         : number | null;
    "bytesPerSecond": number;
  }>
  | Readonly<{ "kind": "log_snapshot" | "log_lines"; "lines": ReadonlyArray<string> }>
  | Readonly<{ "kind": "log_truncated" }>
  | DownloadContract.DownloadBatchProgressEvent;
