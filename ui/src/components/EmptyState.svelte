<script lang="ts">
  interface Props {
    onSuggestion: (text: string) => void;
  }

  let { onSuggestion }: Props = $props();

  const suggestions = [
    'A settings page with a sidebar',
    'A Stripe-style pricing table',
    'A dashboard with charts and cards',
  ];
</script>

<div class="empty-canvas">
  <h2 class="empty-canvas-heading">What would you like to build?</h2>
  <p class="empty-canvas-subtitle">Describe your interface and watch it come to life</p>
  <div class="empty-canvas-suggestions">
    {#each suggestions as suggestion, i}
      <button
        class="suggestion-chip"
        style="animation-delay: {0.2 + i * 0.1}s"
        onclick={() => onSuggestion(suggestion)}
      >
        {suggestion}
      </button>
    {/each}
  </div>
</div>

<style>
  .empty-canvas {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 24px;
    padding: 40px 24px;
    background-image: radial-gradient(circle, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
    background-size: 24px 24px;
    background-position: center center;
    transition: opacity 300ms ease;
  }

  .empty-canvas-heading {
    font-size: 28px;
    font-weight: 600;
    color: var(--text-secondary);
    text-align: center;
    letter-spacing: -0.5px;
    animation: staggerFadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
  }

  .empty-canvas-subtitle {
    font-size: 13px;
    color: var(--text-tertiary);
    text-align: center;
    margin-top: -12px;
    animation: staggerFadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both;
  }

  .empty-canvas-suggestions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    max-width: 360px;
  }

  .suggestion-chip {
    display: block;
    width: 100%;
    text-align: left;
    padding: 14px 16px;
    font-family: var(--font);
    font-size: 13px;
    color: var(--text-secondary);
    background: var(--surface);
    border: 1px solid var(--border);
    border-left: 2px solid var(--accent);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
    animation: staggerFadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .suggestion-chip:hover {
    background: var(--surface-elevated);
    color: var(--text);
    border-color: var(--border-hover);
    border-left-color: var(--accent);
    transform: translateX(2px);
  }

  .suggestion-chip:active {
    transform: translateX(2px) scale(0.99);
  }

  @media (max-width: 640px) {
    .empty-canvas-heading {
      font-size: 22px;
    }

    .empty-canvas-suggestions {
      max-width: 100%;
    }

    .empty-canvas {
      background-size: 20px 20px;
    }
  }
</style>
