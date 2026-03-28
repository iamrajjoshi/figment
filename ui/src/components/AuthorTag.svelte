<script lang="ts">
  import { authorName } from '../lib/stores';

  let editing = $state(false);
  let editValue = $state('');
  let inputEl: HTMLInputElement | undefined = $state();

  function startEdit() {
    if (editing) return;
    editing = true;
    editValue = $authorName || '';
    // Tick to let DOM update before focusing
    setTimeout(() => {
      inputEl?.focus();
      inputEl?.select();
    }, 0);
  }

  function commitEdit() {
    if (!editing) return;
    editing = false;
    const newName = editValue.trim() || 'Anonymous';
    authorName.set(newName);
  }

  function cancelEdit() {
    if (!editing) return;
    editing = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  }
</script>

{#if editing}
  <input
    type="text"
    class="author-tag-input"
    maxlength={100}
    autocomplete="off"
    bind:this={inputEl}
    bind:value={editValue}
    onblur={commitEdit}
    onkeydown={handleKeydown}
  />
{:else}
  <span
    class="author-tag"
    title="Click to change name"
    role="button"
    tabindex="0"
    onclick={startEdit}
    onkeydown={(e) => e.key === 'Enter' && startEdit()}
  >
    {$authorName || 'Anonymous'}
  </span>
{/if}

<style>
  .author-tag {
    flex-shrink: 0;
    padding: 4px 8px;
    background: var(--surface-inset);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-family: var(--font);
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease;
    line-height: 1.5;
    margin-bottom: 6px;
  }

  .author-tag:hover {
    border-color: var(--border-hover);
    color: var(--text);
  }

  .author-tag-input {
    flex-shrink: 0;
    width: 90px;
    padding: 4px 8px;
    font-family: var(--font);
    font-size: 12px;
    font-weight: 500;
    color: var(--text);
    background: var(--surface-inset);
    border: 1px solid var(--border-focus);
    border-radius: var(--radius-sm);
    outline: none;
    box-shadow: 0 0 0 3px var(--accent-glow);
    margin-bottom: 6px;
    line-height: 1.5;
  }

  @media (max-width: 640px) {
    .author-tag,
    .author-tag-input {
      display: none !important;
    }
  }
</style>
