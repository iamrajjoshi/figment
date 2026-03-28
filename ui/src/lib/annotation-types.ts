export interface Annotation {
  id: string;
  type: "rect" | "circle" | "arrow" | "pin" | "freeform";
  author: string;
  color: string;
  strokeWidth: number;
  // rect fields
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  // circle fields
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  // arrow fields
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  // pin fields
  label?: string;
  // freeform fields
  points?: Array<{ x: number; y: number }>;
}
