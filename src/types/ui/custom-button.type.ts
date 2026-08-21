export type CustomButtonType = {
  "idRoot"   : string;
  "label"   ?: string;
  "disabled"?: boolean;
  "icon"    ?: string;
  "tooltip" ?: string;
  "onClick" ?: (event: MouseEvent) => void;
  "invert"  ?: boolean;
  "hide"    ?: "sm" | "md" | boolean;
};
