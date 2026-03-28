<script lang="ts">
  import { queue, authorName, showToast } from '../lib/stores';
  import { submitPrompt } from '../lib/api';
  import PromptBubble from './PromptBubble.svelte';
  import AuthorTag from './AuthorTag.svelte';

  let promptText = $state('');
  let isSubmitting = $state(false);
  let textareaEl: HTMLTextAreaElement | undefined = $state();

  let activePrompts = $derived(
    $queue.filter((q) => q.status === 'pending' || q.status === 'processing')
  );

  let hasProcessing = $derived(
    activePrompts.some((q) => q.status === 'processing')
  );

  function autoResize() {
    if (!textareaEl) return;
    textareaEl.style.height = 'auto';
    textareaEl.style.height = Math.min(textareaEl.scrollHeight, 120) + 'px';
  }

  async function handleSubmit() {
    const text = promptText.trim();
    if (!text || isSubmitting) return;

    const author = $authorName || 'Anonymous';
    isSubmitting = true;

    try {
      await submitPrompt(text, author);
      promptText = '';
      if (textareaEl) {
        textareaEl.style.height = 'auto';
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to submit prompt', true);
    } finally {
      isSubmitting = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  export function fillPrompt(text: string) {
    promptText = text;
    setTimeout(() => {
      autoResize();
      textareaEl?.focus();
    }, 0);
  }
</script>

<div class="bottom-bar">
  {#if activePrompts.length > 0}
    <div class="prompt-queue">
      {#each activePrompts as prompt (prompt.id)}
        <PromptBubble {prompt} />
      {/each}
    </div>
  {/if}
  <div class="prompt-input-row">
    <AuthorTag />
    <div class="prompt-input-container">
      <textarea
        class="prompt-textarea"
        placeholder="Describe a change..."
        rows={1}
        disabled={isSubmitting}
        bind:this={textareaEl}
        bind:value={promptText}
        oninput={autoResize}
        onkeydown={handleKeydown}
      ></textarea>
      <div class="processing-indicator" class:visible={hasProcessing}>
        <span class="processing-dot"></span>
        <span class="processing-dot"></span>
        <span class="processing-dot"></span>
      </div>
      <button
        class="send-btn"
        title="Send"
        disabled={!promptText.trim() || isSubmitting}
        onclick={handleSubmit}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
      </button>
    </div>
  </div>
</div>

<style>
  .bottom-bar {
    background: var(--surface);
    border-top: 1px solid var(--border);
    padding: 10px 16px;
  }

  .prompt-queue {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 8px;
    margin-bottom: 2px;
    scrollbar-width: none;
  }

  .prompt-queue::-webkit-scrollbar { display: none; }

  .prompt-input-row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    min-height: 40px;
  }

  .prompt-input-container {
    flex: 1;
    position: relative;
  }

  .prompt-textarea {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface-inset);
    color: var(--text);
    font-family: var(--font);
    font-size: 14px;
    line-height: 1.4;
    padding: 10px 48px 10px 14px;
    outline: none;
    resize: none;
    min-height: 42px;
    max-height: 120px;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .prompt-textarea:focus {
    border-color: var(--border-focus);
    box-shadow: 0 0 0 3px var(--accent-glow), 0 0 20px rgba(232, 168, 76, 0.04);
  }

  .prompt-textarea::placeholder {
    color: var(--text-tertiary);
  }

  .prompt-textarea:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .send-btn {
    position: absolute;
    right: 6px;
    bottom: 6px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: var(--accent);
    color: #0D0D0D;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.12s ease, background 0.15s ease;
    z-index: 2;
  }

  .send-btn:hover {
    transform: scale(1.05);
    background: var(--accent-hover);
  }

  .send-btn:active {
    transform: scale(0.95);
  }

  .send-btn:disabled {
    opacity: 0.2;
    cursor: not-allowed;
    transform: none;
  }

  .send-btn svg {
    width: 14px;
    height: 14px;
  }

  .processing-indicator {
    display: flex;
    align-items: center;
    gap: 3px;
    position: absolute;
    right: 44px;
    bottom: 15px;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .processing-indicator.visible {
    opacity: 1;
  }

  .processing-dot {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: var(--accent);
  }

  .processing-dot:nth-child(1) { animation: dotPulse 1.2s ease-in-out infinite 0s; }
  .processing-dot:nth-child(2) { animation: dotPulse 1.2s ease-in-out infinite 0.15s; }
  .processing-dot:nth-child(3) { animation: dotPulse 1.2s ease-in-out infinite 0.3s; }

  @media (max-width: 640px) {
    .bottom-bar {
      padding: 8px 10px;
    }
  }
</style>
