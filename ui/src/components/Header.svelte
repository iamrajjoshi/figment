<script lang="ts">
  import {
    sessionName,
    currentVersion,
    participants,
    role,
    showInviteModal,
    showSettingsModal,
    showToast,
  } from '../lib/stores';
  import { exportPrototype } from '../lib/api';
  import { getAvatarColor, getInitials } from '../lib/utils';

  let isEditor = $derived($role !== 'viewer');

  const maxAvatars = 5;

  let showingAvatars = $derived($participants.slice(0, maxAvatars));
  let overflowCount = $derived(
    $participants.length > maxAvatars ? $participants.length - maxAvatars : 0
  );

  async function handleExport() {
    try {
      await exportPrototype($currentVersion);
    } catch {
      showToast('Failed to export', true);
    }
  }
</script>

<header class="header">
  <div class="header-left">
    <span class="header-logo">Figment</span>
    <span class="header-divider">/</span>
    <span class="header-session">{$sessionName}</span>
  </div>
  <div class="header-center">
    <span class="version-badge">v{$currentVersion}</span>
    <span class="connected-badge">
      <span class="connected-dot"></span>
      <span>{$participants.length}</span>
    </span>
    <div class="avatar-stack">
      {#each showingAvatars as name}
        <div
          class="avatar-circle"
          style="background: {getAvatarColor(name)};"
          title={name}
        >
          {getInitials(name)}
        </div>
      {/each}
      {#if overflowCount > 0}
        <div
          class="avatar-circle"
          style="background: var(--surface-inset); color: var(--text-secondary);"
          title="{overflowCount} more"
        >
          +{overflowCount}
        </div>
      {/if}
    </div>
  </div>
  <div class="header-right">
    <button class="btn-icon" title="Settings" onclick={() => showSettingsModal.set(true)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
    </button>
    <button class="btn-icon" title="Export" onclick={handleExport}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    </button>
    {#if isEditor}
      <button class="btn-icon" title="Invite" onclick={() => showInviteModal.set(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
      </button>
    {/if}
  </div>
</header>

<style>
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    height: 48px;
    min-height: 48px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 10;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .header-logo {
    font-weight: 700;
    font-size: 14px;
    color: var(--text);
    letter-spacing: 0.5px;
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .header-divider {
    color: var(--text-tertiary);
    font-size: 14px;
    font-weight: 300;
    flex-shrink: 0;
    user-select: none;
  }

  .header-session {
    font-size: 14px;
    color: var(--text-secondary);
    font-weight: 400;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .header-center {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .version-badge {
    font-size: 12px;
    font-weight: 600;
    color: var(--accent);
    background: var(--accent-bg);
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    font-variant-numeric: tabular-nums;
  }

  .connected-badge {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .connected-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--positive);
  }

  .avatar-stack {
    display: flex;
    align-items: center;
  }

  .avatar-circle {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 600;
    color: #fff;
    border: 2px solid var(--surface);
    margin-left: -5px;
  }

  .avatar-circle:first-child {
    margin-left: 0;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .btn-icon {
    width: 32px;
    height: 32px;
    padding: 0;
    border-radius: var(--radius-md);
    background: transparent;
    border: 1px solid transparent;
    color: var(--text-tertiary);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s ease, background 0.15s ease;
  }

  .btn-icon:hover {
    color: var(--text);
    background: var(--surface-inset);
  }

  .btn-icon:active {
    transform: scale(0.95);
  }

  .btn-icon svg {
    width: 16px;
    height: 16px;
  }

  @media (max-width: 640px) {
    .header {
      padding: 0 12px;
    }

    .header-center {
      display: none;
    }
  }
</style>
