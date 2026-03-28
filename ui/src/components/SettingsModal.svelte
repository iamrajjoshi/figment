<script lang="ts">
  import { showToast } from '../lib/stores';
  import { importDesignSystem } from '../lib/api';

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open, onClose }: Props = $props();

  let designSystem = $state('');
  let importing = $state(false);

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      designSystem = '';
      onClose();
    }
  }

  function handleCancel() {
    designSystem = '';
    onClose();
  }

  async function handleImport() {
    const dsValue = designSystem.trim();
    if (!dsValue) {
      showToast('Paste a URL or CSS to import', true);
      return;
    }

    importing = true;
    try {
      const data = await importDesignSystem(dsValue);
      onClose();
      designSystem = '';
      if (data && data.token_count) {
        showToast('Design system imported (' + data.token_count + ' tokens)');
      } else {
        showToast('Design system imported');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to import design system', true);
    } finally {
      importing = false;
    }
  }
</script>

{#if open}
  <div
    class="modal-overlay"
    onclick={handleOverlayClick}
    onkeydown={(e) => e.key === 'Escape' && (designSystem = '', onClose())}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="modal-card">
      <h3 class="modal-title">Settings</h3>
      <div class="modal-field">
        <label class="modal-label" for="settings-design-system">Import design system</label>
        <textarea
          id="settings-design-system"
          class="modal-textarea"
          placeholder="Paste a URL or CSS..."
          bind:value={designSystem}
        ></textarea>
        <p class="modal-hint">Paste a design system URL or raw CSS.</p>
      </div>
      <div class="modal-actions">
        <button class="btn" onclick={handleCancel}>Cancel</button>
        <button class="btn btn-primary" disabled={importing} onclick={handleImport}>
          {importing ? 'Importing\u2026' : 'Import'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    animation: fadeIn 0.15s ease;
  }

  .modal-card {
    background: var(--surface-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 24px;
    max-width: 400px;
    width: 90%;
    box-shadow: var(--shadow-lg);
    animation: modalSlideIn 0.2s ease;
  }

  .modal-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 16px;
  }

  .modal-field {
    margin-bottom: 12px;
  }

  .modal-label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 4px;
  }

  .modal-textarea {
    width: 100%;
    padding: 9px 12px;
    font-family: var(--font);
    font-size: 13px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-inset);
    color: var(--text);
    outline: none;
    resize: vertical;
    min-height: 72px;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .modal-textarea:focus {
    border-color: var(--border-focus);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }

  .modal-hint {
    font-size: 12px;
    color: var(--text-tertiary);
    margin-top: 4px;
  }

  .modal-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 16px;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px 12px;
    font-family: var(--font);
    font-size: 13px;
    font-weight: 500;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: var(--surface-inset);
    color: var(--text-secondary);
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    line-height: 1.4;
  }

  .btn:hover {
    background: var(--surface-elevated);
    border-color: var(--border-hover);
    color: var(--text);
  }

  .btn:active {
    transform: scale(0.98);
  }

  .btn-primary {
    background: var(--accent);
    color: #0D0D0D;
    border-color: transparent;
    font-weight: 600;
  }

  .btn-primary:hover {
    background: var(--accent-hover);
    border-color: transparent;
    color: #0D0D0D;
  }

  .btn-primary:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
</style>
