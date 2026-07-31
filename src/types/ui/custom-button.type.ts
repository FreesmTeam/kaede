export type CustomButtonType = {
  "idRoot"   : string;
  "label"    : string;
  "icon"    ?: string;
  "tooltip" ?: string;
  "onClick" ?: () => void;
  "invert"  ?: boolean;
  "hide"    ?: "sm" | "md" | boolean;
};
