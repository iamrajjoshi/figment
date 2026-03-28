<script lang="ts">
  import type { Prompt } from '../lib/types';
  import { toolProgressMap } from '../lib/stores';
  import { truncate } from '../lib/utils';

  interface Props {
    prompt: Prompt;
  }

  let { prompt }: Props = $props();

  let toolText = $derived($toolProgressMap[prompt.id] || '');
  let safeStatus = $derived(
    ['pending', 'processing', 'done', 'error'].includes(prompt.status)
      ? prompt.status
      : 'pending'
  );
</script>

<div class="prompt-bubble" data-prompt-id={prompt.id}>
  <div class="prompt-bubble-top">
    <span class="prompt-bubble-status {safeStatus}"></span>
    <span class="prompt-bubble-author">{prompt.author || 'Anon'}</span>
    <span class="prompt-bubble-text">{truncate(prompt.text, 50)}</span>
  </div>
  {#if safeStatus === 'processing' && toolText}
    <span class="prompt-bubble-tool-progress">{toolText}</span>
  {/if}
</div>

<style>
  .prompt-bubble {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-width: 260px;
    padding: 6px 10px;
    background: var(--surface-inset);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    font-size: 12px;
    color: var(--text-secondary);
    animation: fadeIn 0.2s ease;
  }

  .prompt-bubble-top {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .prompt-bubble-author {
    font-weight: 600;
    color: var(--text);
    flex-shrink: 0;
    font-size: 11px;
  }

  .prompt-bubble-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .prompt-bubble-status {
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .prompt-bubble-status.pending { background: var(--text-tertiary); }
  .prompt-bubble-status.processing {
    background: var(--warning);
    animation: pulse 1.5s ease-in-out infinite;
  }
  .prompt-bubble-status.done { background: var(--positive); }
  .prompt-bubble-status.error { background: var(--negative); }

  .prompt-bubble-tool-progress {
    font-size: 11px;
    color: var(--text-tertiary);
    font-style: italic;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media (max-width: 640px) {
    .prompt-bubble {
      max-width: 200px;
    }
  }
</style>
