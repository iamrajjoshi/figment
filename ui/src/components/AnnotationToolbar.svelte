<script lang="ts">
  interface Props {
    activeTool: string | null;
    annotationCount: number;
    onToolSelect: (tool: string | null) => void;
    onClear: () => void;
  }

  let { activeTool, annotationCount, onToolSelect, onClear }: Props = $props();
</script>

<div class="annotation-toolbar">
  <div class="tool-group">
    <button
      class="tool-btn"
      class:active={activeTool === null || activeTool === 'cursor'}
      title="Interact (Escape)"
      onclick={() => onToolSelect(null)}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
        <path d="M13 13l6 6"/>
      </svg>
    </button>

    <div class="tool-separator"></div>

    <button
      class="tool-btn"
      class:active={activeTool === 'rect'}
      title="Rectangle (R)"
      onclick={() => onToolSelect(activeTool === 'rect' ? null : 'rect')}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      </svg>
    </button>
  </div>

  {#if annotationCount > 0}
    <div class="tool-group">
      <span class="annotation-count">{annotationCount}</span>
      <button
        class="tool-btn clear-btn"
        title="Clear all annotations"
        onclick={onClear}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  {/if}
</div>

<style>
  .annotation-toolbar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 32px;
    padding: 0 8px;
    background: var(--surface);
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
  }

  .tool-group {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .tool-separator {
    width: 1px;
    height: 16px;
    background: var(--border);
    margin: 0 4px;
  }

  .tool-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 24px;
    border: none;
    border-radius: var(--radius-sm, 4px);
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition: background 0.12s ease, color 0.12s ease;
  }

  .tool-btn:hover {
    background: var(--surface-inset);
    color: var(--text);
  }

  .tool-btn.active {
    background: var(--accent-bg, rgba(232, 168, 76, 0.15));
    color: var(--accent);
  }

  .clear-btn:hover {
    background: rgba(220, 80, 80, 0.12);
    color: #dc5050;
  }

  .annotation-count {
    font-size: 11px;
    font-weight: 600;
    color: var(--accent);
    min-width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent-bg, rgba(232, 168, 76, 0.15));
    border-radius: 8px;
    padding: 0 4px;
  }
</style>
