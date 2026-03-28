import { get } from 'svelte/store';
import { fetchTicket } from './api';
import {
  queue,
  currentVersion,
  hasPrototype,
  versions,
  participants,
  toolProgressMap,
  previewVersion,
  showToast,
} from './stores';
import type { Prompt, VersionMeta } from './types';

let eventSource: EventSource | null = null;

/**
 * Open an SSE connection to the server.
 *
 * Fetches a short-lived ticket, then connects to `/api/events?ticket=...`.
 * All incoming events update the corresponding Svelte stores directly.
 * Auto-reconnects on error after a 3-second delay.
 */
export async function connectSSE(): Promise<void> {
  disconnectSSE();

  let ticket: string;
  try {
    ticket = await fetchTicket();
  } catch (err) {
    console.error('SSE connect error:', err);
    setTimeout(() => connectSSE(), 3000);
    return;
  }

  eventSource = new EventSource('/api/events?ticket=' + ticket);

  // --- prompt-added ---
  eventSource.addEventListener('prompt-added', (e: MessageEvent) => {
    const data: Prompt = JSON.parse(e.data);
    queue.update((q) => {
      const exists = q.some((item) => item.id === data.id);
      return exists ? q : [...q, data];
    });
  });

  // --- prompt-updated ---
  eventSource.addEventListener('prompt-updated', (e: MessageEvent) => {
    const data: Partial<Prompt> & { id: string } = JSON.parse(e.data);
    queue.update((q) =>
      q.map((item) => (item.id === data.id ? { ...item, ...data } : item)),
    );

    if (data.status === 'done' || data.status === 'error') {
      toolProgressMap.update((map) => {
        const next = { ...map };
        delete next[data.id];
        return next;
      });
    }
  });

  // --- prototype-updated ---
  eventSource.addEventListener('prototype-updated', (e: MessageEvent) => {
    const data: VersionMeta & { version: number } = JSON.parse(e.data);

    currentVersion.set(data.version);
    hasPrototype.set(true);

    versions.update((v) => {
      const exists = v.some((item) => item.version === data.version);
      return exists ? v : [...v, data];
    });

    // If the user was viewing the previous latest version (or had no preview
    // override), snap them to the new version automatically.
    const pv = get(previewVersion);
    if (pv === null || pv === data.version - 1) {
      previewVersion.set(null);
    }
  });

  // --- participant-joined ---
  eventSource.addEventListener('participant-joined', (e: MessageEvent) => {
    const data: { name: string } = JSON.parse(e.data);
    participants.update((p) =>
      p.includes(data.name) ? p : [...p, data.name],
    );
  });

  // --- participant-left ---
  eventSource.addEventListener('participant-left', (e: MessageEvent) => {
    const data: { name: string } = JSON.parse(e.data);
    participants.update((p) => p.filter((name) => name !== data.name));
  });

  // --- tool-progress ---
  eventSource.addEventListener('tool-progress', (e: MessageEvent) => {
    const data: {
      tool?: string;
      path?: string;
      status?: string;
      prompt_id?: string;
    } = JSON.parse(e.data);

    if (!data.tool) return;

    const friendlyName = data.tool.replace(/_/g, ' ');
    const filename = data.path ? data.path.split('/').pop() || '' : '';

    let text = '';
    if (data.status === 'started') {
      text = friendlyName.charAt(0).toUpperCase() + friendlyName.slice(1);
      if (filename) text += ' ' + filename;
      text += '\u2026';
    }

    toolProgressMap.update((map) => {
      const next = { ...map };

      if (data.prompt_id) {
        if (text) {
          next[data.prompt_id] = text;
        } else if (data.status === 'completed') {
          delete next[data.prompt_id];
        }
      } else {
        // Fall back to the currently-processing prompt
        const currentQueue = get(queue);
        const processing = currentQueue.find((q) => q.status === 'processing');
        if (processing) {
          if (text) {
            next[processing.id] = text;
          } else if (data.status === 'completed') {
            delete next[processing.id];
          }
        }
      }

      return next;
    });
  });

  // --- design-system-updated ---
  eventSource.addEventListener('design-system-updated', (e: MessageEvent) => {
    const data: { token_count?: number } = JSON.parse(e.data);
    const msg =
      data && data.token_count
        ? 'Design system updated (' + data.token_count + ' tokens)'
        : 'Design system updated';

    showToast(msg);
  });

  // --- error / reconnect ---
  eventSource.addEventListener('error', () => {
    setTimeout(() => connectSSE(), 3000);
  });
}

/**
 * Close the current SSE connection, if any.
 */
export function disconnectSSE(): void {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}
