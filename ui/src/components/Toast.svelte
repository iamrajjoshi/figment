<script lang="ts">
  import { toast } from '../lib/stores';
</script>

<div
  class="toast"
  class:visible={$toast.visible}
  class:error={$toast.isError}
>
  {$toast.text}
</div>

<style>
  .toast {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(12px);
    padding: 10px 18px;
    background: var(--surface-elevated);
    color: var(--text);
    font-size: 13px;
    font-weight: 500;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    border-left: 3px solid var(--accent);
    box-shadow: var(--shadow-lg);
    opacity: 0;
    transition: transform 0.2s ease, opacity 0.2s ease;
    z-index: 1000;
    pointer-events: none;
  }

  .toast.visible {
    transform: translateX(-50%) translateY(0);
    opacity: 1;
  }

  .toast.error {
    background: var(--negative);
    color: #fff;
    border-left-color: #fff;
    border-color: var(--negative);
  }
</style>
