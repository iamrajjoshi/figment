<script lang="ts">
  import { onMount } from 'svelte';
  import { token, authorName, extractToken } from './lib/stores';
  import { loadInitialState } from './lib/api';
  import { connectSSE } from './lib/sse';
  import Onboarding from './components/Onboarding.svelte';
  import MainApp from './components/MainApp.svelte';
  import Toast from './components/Toast.svelte';

  let showOnboarding = $state(!localStorage.getItem('figment-name'));
  let ready = $state(false);

  function handleOnboardingComplete() {
    showOnboarding = false;
  }

  onMount(() => {
    extractToken();

    // Load saved author name
    const savedName = localStorage.getItem('figment-name') || localStorage.getItem('figment-author');
    if (savedName) {
      authorName.set(savedName);
    }

    connectSSE();
    loadInitialState();
    ready = true;
  });
</script>

<div class="app">
  {#if showOnboarding}
    <Onboarding onComplete={handleOnboardingComplete} />
  {/if}

  {#if !showOnboarding || ready}
    <MainApp />
  {/if}

  <Toast />
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }
</style>
