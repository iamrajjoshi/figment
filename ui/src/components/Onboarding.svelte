<script lang="ts">
  import { authorName, showToast } from '../lib/stores';
  import { importDesignSystem } from '../lib/api';

  interface Props {
    onComplete: () => void;
  }

  let { onComplete }: Props = $props();

  let name = $state('');
  let designSystem = $state('');
  let loading = $state(false);
  let fadingOut = $state(false);

  function finish() {
    fadingOut = true;
    setTimeout(() => {
      onComplete();
    }, 300);
  }

  async function handleSubmit() {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    localStorage.setItem('figment-name', trimmedName);
    authorName.set(trimmedName);

    const dsValue = designSystem.trim();
    if (dsValue) {
      loading = true;
      try {
        const data = await importDesignSystem(dsValue);
        finish();
        if (data && data.token_count) {
          showToast('Design system imported (' + data.token_count + ' tokens)');
        } else {
          showToast('Design system imported');
        }
      } catch (err: any) {
        loading = false;
        showToast(err.message || 'Failed to import design system', true);
      }
    } else {
      finish();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }
</script>

<div class="onboarding" class:fade-out={fadingOut}>
  <div class="onboarding-card">
    <div class="onboarding-header">
      <h1 class="onboarding-title">Figment</h1>
      <p class="onboarding-subtitle">Collaborative prototyping with AI</p>
    </div>
    <div class="onboarding-field">
      <label class="onboarding-label" for="onboarding-name">Your name</label>
      <input
        type="text"
        id="onboarding-name"
        class="onboarding-input"
        placeholder="e.g. Sarah"
        maxlength={100}
        autocomplete="off"
        bind:value={name}
        onkeydown={handleKeydown}
      />
    </div>
    <div class="onboarding-field">
      <label class="onboarding-label" for="onboarding-design-system">
        Design system <span class="onboarding-optional">(optional)</span>
      </label>
      <textarea
        id="onboarding-design-system"
        class="onboarding-textarea"
        placeholder="Paste a URL or CSS..."
        bind:value={designSystem}
      ></textarea>
      <p class="onboarding-hint">Import tokens from a URL or paste raw CSS.</p>
    </div>
    <button
      class="onboarding-btn"
      disabled={!name.trim() || loading}
      onclick={handleSubmit}
    >
      Continue
    </button>
    {#if loading}
      <p class="onboarding-loading">Importing design system...</p>
    {/if}
  </div>
</div>

<style>
  .onboarding {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
    background-image: radial-gradient(ellipse 600px 400px at 50% 45%, rgba(232, 168, 76, 0.04) 0%, transparent 100%);
    transition: opacity 300ms ease;
  }

  .onboarding.fade-out {
    opacity: 0;
    pointer-events: none;
  }

  .onboarding-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 32px;
    width: 90%;
    max-width: 380px;
    box-shadow: var(--shadow-lg);
  }

  .onboarding-header {
    margin-bottom: 28px;
  }

  .onboarding-title {
    font-size: 20px;
    font-weight: 700;
    color: var(--text);
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .onboarding-subtitle {
    font-size: 13px;
    color: var(--text-tertiary);
    margin-top: 4px;
  }

  .onboarding-field {
    margin-bottom: 16px;
  }

  .onboarding-label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 6px;
  }

  .onboarding-optional {
    color: var(--text-tertiary);
    font-weight: 400;
  }

  .onboarding-hint {
    font-size: 12px;
    color: var(--text-tertiary);
    margin-top: 4px;
  }

  .onboarding-input,
  .onboarding-textarea {
    width: 100%;
    padding: 9px 12px;
    font-family: var(--font);
    font-size: 14px;
    line-height: 1.5;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-inset);
    color: var(--text);
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .onboarding-input:focus,
  .onboarding-textarea:focus {
    border-color: var(--border-focus);
    box-shadow: 0 0 0 3px var(--accent-glow), 0 0 20px rgba(232, 168, 76, 0.04);
  }

  .onboarding-input::placeholder,
  .onboarding-textarea::placeholder {
    color: var(--text-tertiary);
  }

  .onboarding-textarea {
    resize: vertical;
    min-height: 72px;
  }

  .onboarding-btn {
    width: 100%;
    padding: 10px 16px;
    font-family: var(--font);
    font-size: 14px;
    font-weight: 600;
    border-radius: var(--radius-md);
    border: none;
    background: var(--accent);
    color: #0D0D0D;
    cursor: pointer;
    transition: background 0.15s ease, transform 0.1s ease;
    margin-top: 4px;
  }

  .onboarding-btn:hover {
    background: var(--accent-hover);
  }

  .onboarding-btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .onboarding-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .onboarding-loading {
    font-size: 13px;
    color: var(--text-tertiary);
    margin-top: 10px;
    text-align: center;
    animation: pulse 1.5s ease-in-out infinite;
  }
</style>
