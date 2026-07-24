import type { DownloadReport } from "@/lib/capability-broker/types.ts";

export type HostDownloadBatchRequest = Readonly<{
  "kind"       : "host_download_batch";
  "entries"    : ReadonlyArray<Readonly<{ "url": string; "path": string }>>;
  "concurrency": number;
  "label"      : string;
  "cancelId"   : string;
}>;

export type HostCancelDownloadsRequest = Readonly<{
  "kind"    : "host_cancel_downloads";
  "cancelId": string;
}>;

export type DownloadReportResponse = Readonly<{
  "kind": "download_report";
}> & DownloadReport;

export type DownloadBatchProgressEvent = Readonly<{
  "kind"   : "download_batch_progress";
  "current": Readonly<Record<string, readonly [number, number]>>;
  "success": number;
  "failed" : number;
}>;
