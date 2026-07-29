export type CustomButtonType = {
  "icon" ?: string;
  "label"?: string;
  "ids"   : {
    "wrapper": string;
    "icon"   : string;
    "label" ?: string;
  };
  "tooltip" ?: string;
  "onClick" ?: () => void;
  "invert"  ?: boolean;
  "hideOnSm"?: boolean;
  "hideOnMd"?: boolean;
  "hidden"  ?: boolean;
};
