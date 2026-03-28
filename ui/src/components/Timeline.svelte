<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { versions, currentVersion, previewVersion, role, showToast } from '../lib/stores';
  import { revertToVersion } from '../lib/api';
  import { truncate } from '../lib/utils';

  let pillsContainer: HTMLDivElement | undefined = $state();

  let sortedVersions = $derived(
    [...$versions].sort((a, b) => a.version - b.version)
  );

  let viewingVersion = $derived(
    $previewVersion !== null ? $previewVersion : $currentVersion
  );

  let isEditor = $derived($role !== 'viewer');

  let showRevert = $derived(
    isEditor && $previewVersion !== null && $previewVersion !== $currentVersion
  );

  function handlePillClick(version: number) {
    previewVersion.set(version);
  }

  async function handleRevert() {
    if ($previewVersion === null) return;
    try {
      await revertToVersion($previewVersion);
      showToast('Reverted to v' + $previewVersion);
    } catch (err: any) {
      showToast(err.message || 'Failed to revert', true);
    }
  }

  // Auto-scroll to active pill when versions change
  $effect(() => {
    // Depend on the sortedVersions and viewingVersion
    const _v = sortedVersions;
    const _vv = viewingVersion;
    tick().then(() => {
      const activePill = pillsContainer?.querySelector('.timeline-pill.active');
      if (activePill) {
        activePill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    });
  });
</script>

<div class="timeline">
  <span class="timeline-label">Versions</span>
  <div class="timeline-pills" bind:this={pillsContainer}>
    {#if sortedVersions.length === 0}
      <span class="compat-hidden">No versions yet</span>
    {:else}
      {#each sortedVersions as v (v.version)}
        <button
          class="timeline-pill"
          class:active={v.version === viewingVersion}
          title="{v.prompt ? truncate(v.prompt, 80) : ''}{v.author ? ' by ' + v.author : ''}"
          onclick={() => handlePillClick(v.version)}
        >
          v{v.version}
        </button>
      {/each}
    {/if}
  </div>
  <button
    class="timeline-revert-btn"
    class:visible={showRevert}
    onclick={handleRevert}
  >
    Revert
  </button>
</div>

<style>
  .timeline {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0 16px;
    height: 36px;
    min-height: 36px;
    background: var(--surface);
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .timeline::-webkit-scrollbar { display: none; }

  .timeline-label {
    font-size: 10px;
    color: var(--text-tertiary);
    font-weight: 600;
    margin-right: 8px;
    white-space: nowrap;
    flex-shrink: 0;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .timeline-pills {
    display: flex;
    align-items: center;
    gap: 1px;
    flex: 1;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .timeline-pills::-webkit-scrollbar { display: none; }

  .timeline-pill {
    flex-shrink: 0;
    padding: 4px 10px;
    font-family: var(--font);
    font-size: 12px;
    font-weight: 500;
    color: var(--text-tertiary);
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: color 0.15s ease, background 0.15s ease;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .timeline-pill:hover {
    color: var(--text-secondary);
    background: var(--surface-inset);
  }

  .timeline-pill.active {
    color: var(--accent);
    background: var(--accent-bg);
    font-weight: 600;
  }

  .timeline-revert-btn {
    flex-shrink: 0;
    margin-left: auto;
    padding: 3px 8px;
    font-family: var(--font);
    font-size: 11px;
    font-weight: 500;
    color: var(--text-tertiary);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.15s ease;
    opacity: 0;
    pointer-events: none;
  }

  .timeline-revert-btn.visible {
    opacity: 1;
    pointer-events: auto;
  }

  .timeline-revert-btn:hover {
    color: var(--accent);
    border-color: var(--accent);
    background: var(--accent-bg);
  }
</style>
