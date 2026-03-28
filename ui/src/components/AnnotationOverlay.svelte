<script lang="ts">
  import type { Annotation } from '../lib/annotation-types';

  interface Props {
    annotations: Annotation[];
    activeTool: string | null;
    onAnnotationCreated: (a: Annotation) => void;
    author: string;
  }

  let { annotations, activeTool, onAnnotationCreated, author }: Props = $props();

  let svgEl: SVGSVGElement | undefined = $state();
  let isDrawing = $state(false);
  let startPoint = $state<{ x: number; y: number } | null>(null);
  let currentPoint = $state<{ x: number; y: number } | null>(null);

  const STROKE_COLOR = '#E8A84C';
  const FILL_COLOR = 'rgba(232,168,76,0.08)';
  const STROKE_WIDTH = 2;

  function toPercent(e: MouseEvent): { x: number; y: number } | null {
    if (!svgEl) return null;
    const rect = svgEl.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  }

  function handleMouseDown(e: MouseEvent) {
    if (!activeTool || activeTool === 'cursor') return;
    const pt = toPercent(e);
    if (!pt) return;
    isDrawing = true;
    startPoint = pt;
    currentPoint = pt;
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDrawing || !startPoint) return;
    currentPoint = toPercent(e);
  }

  function handleMouseUp() {
    if (!isDrawing || !startPoint || !currentPoint) {
      isDrawing = false;
      return;
    }

    const minSize = 1; // minimum 1% in either dimension
    if (activeTool === 'rect') {
      const x = Math.min(startPoint.x, currentPoint.x);
      const y = Math.min(startPoint.y, currentPoint.y);
      const w = Math.abs(currentPoint.x - startPoint.x);
      const h = Math.abs(currentPoint.y - startPoint.y);

      if (w >= minSize || h >= minSize) {
        onAnnotationCreated({
          id: crypto.randomUUID(),
          type: 'rect',
          author,
          color: STROKE_COLOR,
          strokeWidth: STROKE_WIDTH,
          x,
          y,
          width: w,
          height: h,
        });
      }
    }

    isDrawing = false;
    startPoint = null;
    currentPoint = null;
  }

  function inProgressRect(): { x: number; y: number; width: number; height: number } | null {
    if (!isDrawing || !startPoint || !currentPoint || activeTool !== 'rect') return null;
    return {
      x: Math.min(startPoint.x, currentPoint.x),
      y: Math.min(startPoint.y, currentPoint.y),
      width: Math.abs(currentPoint.x - startPoint.x),
      height: Math.abs(currentPoint.y - startPoint.y),
    };
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<svg
  bind:this={svgEl}
  class="annotation-overlay"
  class:active={activeTool !== null && activeTool !== 'cursor'}
  viewBox="0 0 100 100"
  preserveAspectRatio="none"
  onmousedown={handleMouseDown}
  onmousemove={handleMouseMove}
  onmouseup={handleMouseUp}
  onmouseleave={handleMouseUp}
>
  <!-- Completed annotations -->
  {#each annotations as ann (ann.id)}
    {#if ann.type === 'rect' && ann.x != null && ann.y != null && ann.width != null && ann.height != null}
      <rect
        x={ann.x}
        y={ann.y}
        width={ann.width}
        height={ann.height}
        fill={FILL_COLOR}
        stroke={ann.color}
        stroke-width={ann.strokeWidth / 5}
        vector-effect="non-scaling-stroke"
        rx="0.3"
        ry="0.3"
      />
    {/if}
  {/each}

  <!-- In-progress annotation -->
  {#if inProgressRect()}
    {@const r = inProgressRect()!}
    <rect
      x={r.x}
      y={r.y}
      width={r.width}
      height={r.height}
      fill={FILL_COLOR}
      stroke={STROKE_COLOR}
      stroke-width={STROKE_WIDTH / 5}
      stroke-dasharray="1 0.5"
      vector-effect="non-scaling-stroke"
      rx="0.3"
      ry="0.3"
    />
  {/if}
</svg>

<style>
  .annotation-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 4;
    pointer-events: none;
  }

  .annotation-overlay.active {
    pointer-events: auto;
    cursor: crosshair;
  }
</style>
