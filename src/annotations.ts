/** All coordinates are percentages (0-100) of the preview viewport */

export interface AnnotationBase {
  id: string;
  type: string;
  author: string;
  color: string;
  strokeWidth: number;
}

export interface RectAnnotation extends AnnotationBase {
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CircleAnnotation extends AnnotationBase {
  type: "circle";
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface ArrowAnnotation extends AnnotationBase {
  type: "arrow";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface PinAnnotation extends AnnotationBase {
  type: "pin";
  x: number;
  y: number;
  label?: string;
}

export interface FreeformAnnotation extends AnnotationBase {
  type: "freeform";
  points: Array<{ x: number; y: number }>;
}

export type Annotation =
  | RectAnnotation
  | CircleAnnotation
  | ArrowAnnotation
  | PinAnnotation
  | FreeformAnnotation;

const VALID_TYPES = new Set(["rect", "circle", "arrow", "pin", "freeform"]);

export function validateAnnotations(annotations: unknown): Annotation[] | null {
  if (!Array.isArray(annotations)) return null;
  if (annotations.length > 20) return null;

  const valid: Annotation[] = [];
  for (const a of annotations) {
    if (!a || typeof a !== "object") return null;
    if (!VALID_TYPES.has(a.type)) return null;
    if (typeof a.id !== "string") return null;
    valid.push(a as Annotation);
  }
  return valid;
}

/** Convert annotations to natural language spatial descriptions for Claude */
export function formatAnnotationsAsText(annotations: Annotation[]): string {
  if (!annotations.length) return "";

  const lines = annotations.map((a) => {
    switch (a.type) {
      case "rect": {
        const bottom = a.y + a.height;
        const right = a.x + a.width;
        const region = describeRegion(a.x, a.y, right, bottom);
        return `- Rectangle at ${region} (x: ${r(a.x)}-${r(right)}%, y: ${r(a.y)}-${r(bottom)}%)`;
      }
      case "circle": {
        const region = describePoint(a.cx, a.cy);
        return `- Circle around ${region} (center: ${r(a.cx)}%, ${r(a.cy)}%, radius: ~${r(a.rx)}%×${r(a.ry)}%)`;
      }
      case "arrow": {
        const from = describePoint(a.x1, a.y1);
        const to = describePoint(a.x2, a.y2);
        return `- Arrow from ${from} (${r(a.x1)}%, ${r(a.y1)}%) to ${to} (${r(a.x2)}%, ${r(a.y2)}%)`;
      }
      case "pin": {
        const region = describePoint(a.x, a.y);
        const label = a.label ? ` labeled "${a.label}"` : "";
        return `- Pin at ${region} (${r(a.x)}%, ${r(a.y)}%)${label}`;
      }
      case "freeform": {
        if (!a.points.length) return "- Freeform drawing (empty)";
        const xs = a.points.map((p) => p.x);
        const ys = a.points.map((p) => p.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const region = describeRegion(minX, minY, maxX, maxY);
        return `- Freeform drawing around ${region} (bounding box: x: ${r(minX)}-${r(maxX)}%, y: ${r(minY)}-${r(maxY)}%)`;
      }
    }
  });

  return "User annotations on the current page:\n" + lines.join("\n");
}

function r(n: number): string {
  return Math.round(n).toString();
}

function describePoint(x: number, y: number): string {
  const vPos = y < 20 ? "top" : y > 80 ? "bottom" : "middle";
  const hPos = x < 30 ? "left" : x > 70 ? "right" : "center";
  if (vPos === "middle" && hPos === "center") return "center of the page";
  return `${vPos}-${hPos} area`;
}

function describeRegion(x1: number, y1: number, x2: number, y2: number): string {
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const height = y2 - y1;
  const width = x2 - x1;

  if (width > 80 && height < 15 && y1 < 10) return "the top of the page (likely header/navigation)";
  if (width > 80 && height < 15 && y2 > 90) return "the bottom of the page (likely footer)";
  if (width < 30 && x1 < 5) return "the left side (likely sidebar)";
  if (width < 30 && x2 > 95) return "the right side (likely sidebar)";
  if (width > 80 && height > 80) return "most of the page";

  return describePoint(cx, cy);
}
