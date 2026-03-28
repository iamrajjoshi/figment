<script lang="ts">
  import { showToast } from '../lib/stores';
  import { generateInvite } from '../lib/api';

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open, onClose }: Props = $props();

  let name = $state('');
  let selectedRole = $state<'editor' | 'viewer'>('editor');
  let inviteLink = $state('');
  let showResult = $state(false);

  function resetState() {
    name = '';
    selectedRole = 'editor';
    inviteLink = '';
    showResult = false;
  }

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      resetState();
      onClose();
    }
  }

  function handleCancel() {
    resetState();
    onClose();
  }

  async function handleGenerate() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      showToast('Enter a name', true);
      return;
    }

    try {
      const data = await generateInvite(trimmedName, selectedRole);
      const baseUrl = window.location.origin;
      inviteLink = baseUrl + '/?t=' + data.token;
      showResult = true;
    } catch (err: any) {
      showToast(err.message || 'Failed to generate invite', true);
    }
  }

  function handleLinkClick(e: MouseEvent) {
    const target = e.target as HTMLInputElement;
    target.select();
  }
</script>

{#if open}
  <div
    class="modal-overlay"
    onclick={handleOverlayClick}
    onkeydown={(e) => e.key === 'Escape' && (resetState(), onClose())}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="modal-card">
      <h3 class="modal-title">Invite collaborator</h3>
      <div class="modal-field">
        <label class="modal-label" for="invite-name">Name</label>
        <input
          type="text"
          id="invite-name"
          class="modal-input"
          placeholder="Alice"
          maxlength={100}
          bind:value={name}
        />
      </div>
      <div class="modal-field">
        <label class="modal-label" for="invite-role">Role</label>
        <select id="invite-role" class="modal-select" bind:value={selectedRole}>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
      </div>
      <div class="modal-actions">
        <button class="btn" onclick={handleCancel}>Cancel</button>
        <button class="btn btn-primary" onclick={handleGenerate}>Generate link</button>
      </div>
      {#if showResult}
        <div class="modal-result">
          <label class="modal-result-label" for="invite-link">Share this link</label>
          <input
            type="text"
            id="invite-link"
            class="modal-result-input"
            readonly
            value={inviteLink}
            onclick={handleLinkClick}
          />
        </div>
      {/if}
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

  .modal-input {
    width: 100%;
    padding: 9px 12px;
    font-family: var(--font);
    font-size: 13px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-inset);
    color: var(--text);
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .modal-input:focus {
    border-color: var(--border-focus);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }

  .modal-select {
    width: 100%;
    padding: 9px 12px;
    font-family: var(--font);
    font-size: 13px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-inset);
    color: var(--text);
    outline: none;
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235A5A56' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: 28px;
  }

  .modal-select:focus {
    border-color: var(--border-focus);
    box-shadow: 0 0 0 3px var(--accent-glow);
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

  .modal-result {
    margin-top: 12px;
    padding: 10px;
    background: var(--surface-inset);
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
  }

  .modal-result-label {
    display: block;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-tertiary);
    margin-bottom: 4px;
  }

  .modal-result-input {
    width: 100%;
    padding: 6px 8px;
    font-family: var(--font-mono);
    font-size: 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg);
    color: var(--text);
    outline: none;
  }
</style>
