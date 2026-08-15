import PermissionData from "@/constants/permission-data.json";
import type { PermissionType } from "@/types/extensions/permission.type.ts";
import IsKeyInObject from "@/types/utils/is-key-in-object.ts";

export const Permissions = {
  "Time": {
    "Performance": "time::performance",
    "Date"       : "time::date",
  },
  "UI": {
    "Basic"        : "ui::basic",
    "Interactivity": "ui::interactivity",
  },
  "Events": {
    "Page"             : "events::page",
    "InstanceSelection": "events::instance-selection",
  },
  "Internet": {
    "HTTPGet" : "internet::http-get",
    "HTTPPost": "internet::http-post",
  },
  "Log": {
    "Write" : "log::write",
    "Read"  : "log::read",
    "Stream": "log::stream",
  },
  "InternalStorage": {
    "Read" : "internal-storage::read",
    "Write": "internal-storage::write",
  },
  "ExternalStorage": {
    "Read" : "external-storage::read",
    "Write": "external-storage::write",
  },
} as const satisfies Record<
  string,
  Record<string, `${string}::${string}`>
>;
export const PermissionsList: Array<PermissionType> = Object
  .values(Permissions)
  .flatMap(scope => Object.values(scope));

export const getPermissionDisplayData: (id: string | undefined) => {
  "label"      : string;
  "icon"       : string;
  "description": string;
} = id => {
  if (!id) {
    return {
      "label"      : "do unknown",
      "icon"       : "i-lucide-question-mark",
      "description": "The requested permission is undefined",
    };
  }

  const [base, scope]: Array<string> = id.split("::");
  const requested: string = `${base}::${scope}`;

  if (IsKeyInObject(requested, PermissionData)) {
    return PermissionData[requested];
  }

  return {
    "label"      : "do unknown",
    "icon"       : "i-lucide-question-mark",
    "description": "The requested permission does not exist in the list of available permissions",
  };
};

export default {
  Permissions,
  PermissionsList,
  getPermissionDisplayData,
} as const;
