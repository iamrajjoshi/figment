<script lang="ts">
  import {
    currentVersion,
    hasPrototype,
    queue,
    role,
    showInviteModal,
    showSettingsModal,
    annotations,
    activeTool,
  } from '../lib/stores';
  import Header from './Header.svelte';
  import EmptyState from './EmptyState.svelte';
  import Preview from './Preview.svelte';
  import AnnotationToolbar from './AnnotationToolbar.svelte';
  import Timeline from './Timeline.svelte';
  import BottomBar from './BottomBar.svelte';
  import InviteModal from './InviteModal.svelte';
  import SettingsModal from './SettingsModal.svelte';

  let bottomBarRef: BottomBar | undefined = $state();

  let isProcessing = $derived(
    $queue.some((q) => q.status === 'processing')
  );

  let showEmpty = $derived(
    $currentVersion === 0 && !$hasPrototype && !isProcessing
  );

  let isEditor = $derived($role !== 'viewer');

  function handleSuggestion(text: string) {
    bottomBarRef?.fillPrompt(text);
  }
</script>

<div class="main-app">
  <Header />

  <div class="canvas">
    {#if showEmpty}
      <EmptyState onSuggestion={handleSuggestion} />
    {:else}
      <Preview />
    {/if}
  </div>

  {#if !showEmpty}
    <AnnotationToolbar
      activeTool={$activeTool}
      annotationCount={$annotations.length}
      onToolSelect={(tool) => activeTool.set(tool)}
      onClear={() => annotations.set([])}
    />
  {/if}

  <Timeline />

  {#if isEditor}
    <BottomBar bind:this={bottomBarRef} />
  {/if}

  <InviteModal open={$showInviteModal} onClose={() => showInviteModal.set(false)} />
  <SettingsModal open={$showSettingsModal} onClose={() => showSettingsModal.set(false)} />
</div>

<style>
  .main-app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  .canvas {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    position: relative;
  }
</style>
