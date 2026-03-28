<script lang="ts">
  import { onMount } from 'svelte';
  import { currentVersion, previewVersion, hasPrototype, queue, annotations, activeTool, authorName } from '../lib/stores';
  import { fetchTicket } from '../lib/api';
  import type { Annotation } from '../lib/annotation-types';
  import AnnotationOverlay from './AnnotationOverlay.svelte';

  let iframeSrc = $state('about:blank');
  let isShimmering = $state(false);
  let viewingBadgeText = $state('');
  let showViewingBadge = $state(false);
  let fadeInClass = $state(false);

  let isProcessing = $derived(
    $queue.some((q) => q.status === 'processing')
  );

  // Track when the preview should show shimmer
  $effect(() => {
    isShimmering = isProcessing;
  });

  // Track viewing badge visibility
  $effect(() => {
    if ($previewVersion !== null && $previewVersion !== $currentVersion) {
      viewingBadgeText = 'Viewing v' + $previewVersion;
      showViewingBadge = true;
    } else {
      showViewingBadge = false;
    }
  });

  // Load preview when version changes
  $effect(() => {
    const version = $previewVersion ?? $currentVersion;
    if (version > 0 || $hasPrototype) {
      loadPreview(version);
    }
  });

  async function loadPreview(version: number) {
    try {
      const ticket = await fetchTicket();
      iframeSrc = '/preview/' + version + '?ticket=' + ticket + '&cb=' + Date.now();
      fadeInClass = true;
      setTimeout(() => { fadeInClass = false; }, 300);
    } catch {
      // Silently fail -- auth error
    }
  }

  onMount(() => {
    if ($currentVersion > 0 || $hasPrototype) {
      loadPreview($previewVersion ?? $currentVersion);
    }
  });
</script>

<div
  class="preview-wrapper"
  class:shimmer={isShimmering}
  class:fade-in={fadeInClass}
>
  <span
    class="preview-viewing-badge"
    class:visible={showViewingBadge}
  >
    {viewingBadgeText}
  </span>
  <iframe
    class="preview-iframe"
    src={iframeSrc}
    sandbox="allow-scripts"
    title="Live Preview"
  ></iframe>
  <AnnotationOverlay
    annotations={$annotations}
    activeTool={$activeTool}
    author={$authorName || 'Anonymous'}
    onAnnotationCreated={(a: Annotation) => {
      annotations.update((list) => [...list, a]);
    }}
  />
</div>

<style>
  .preview-wrapper {
    flex: 1;
    position: relative;
    margin: 12px;
    border-radius: var(--radius-lg);
    overflow: hidden;
    border: 1px solid var(--border);
    background: #fff;
    box-shadow: var(--shadow-md);
    transition: opacity 300ms ease;
  }

  .preview-wrapper.fade-in {
    animation: fadeIn 0.3s ease;
  }

  .preview-wrapper.shimmer::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    height: 2px;
    width: 40%;
    background: linear-gradient(90deg, transparent, var(--accent), transparent);
    z-index: 10;
    border-radius: 0 1px 1px 0;
    animation: loadSlide 1.8s ease-in-out infinite;
  }

  .preview-iframe {
    position: relative;
    width: 100%;
    height: 100%;
    border: none;
    background: #fff;
    display: block;
    z-index: 1;
  }

  .preview-viewing-badge {
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    padding: 5px 12px;
    background: rgba(13, 13, 13, 0.85);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    color: var(--text);
    font-size: 11px;
    font-weight: 600;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    opacity: 0;
    transition: opacity 0.15s ease;
    pointer-events: none;
    z-index: 5;
  }

  .preview-viewing-badge.visible {
    opacity: 1;
  }

  @media (max-width: 640px) {
    .preview-wrapper {
      margin: 6px;
      border-radius: var(--radius-md);
    }
  }
</style>
