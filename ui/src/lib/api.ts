import { get } from 'svelte/store';
import {
  authHeaders,
  token,
  sessionName,
  currentVersion,
  queue,
  versions,
  participants,
  hasPrototype,
} from './stores';

/**
 * Fetch a short-lived SSE/preview ticket from the server.
 * Rejects if there is no auth token.
 */
export async function fetchTicket(): Promise<string> {
  if (!get(token)) {
    throw new Error('No auth token \u2014 use the full URL with ?t= parameter');
  }

  const res = await fetch('/api/ticket', {
    method: 'POST',
    headers: authHeaders(),
  });

  if (!res.ok) throw new Error('Ticket request failed (' + res.status + ')');

  const data = await res.json();
  return data.ticket;
}

/**
 * Load initial session state and populate all stores.
 */
export async function loadInitialState(): Promise<void> {
  if (!get(token)) {
    throw new Error('No auth token \u2014 use the full URL with ?t= parameter');
  }

  const res = await fetch('/api/state', { headers: authHeaders() });

  if (!res.ok) throw new Error('State request failed (' + res.status + ')');

  const data = await res.json();

  sessionName.set(data.session_name || 'Untitled session');
  currentVersion.set(data.current_version || 0);
  queue.set(data.queue || []);
  versions.set(data.versions || []);
  participants.set(data.participants || []);
  hasPrototype.set(!!data.has_prototype);
}

/**
 * Submit a new prompt to the queue.
 */
export async function submitPrompt(text: string, author: string): Promise<void> {
  const res = await fetch('/api/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ text, author }),
  });

  if (res.status === 429) {
    throw new Error('Rate limited. Please wait a moment.');
  }

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to submit prompt');
  }
}

/**
 * Revert the prototype to a previous version.
 */
export async function revertToVersion(version: number): Promise<void> {
  const res = await fetch('/api/revert/' + version, {
    method: 'POST',
    headers: authHeaders(),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to revert');
  }
}

/**
 * Open the current prototype version in a new tab for export/download.
 */
export async function exportPrototype(version: number): Promise<void> {
  const ticket = await fetchTicket();
  window.open('/preview/' + version + '?ticket=' + ticket + '&download=1', '_blank');
}

/**
 * Generate an invite link for a collaborator.
 * Returns the raw token string from the server.
 */
export async function generateInvite(
  name: string,
  role: 'editor' | 'viewer',
): Promise<{ token: string }> {
  const res = await fetch('/api/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ role, name }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to generate invite');
  }

  return res.json();
}

/**
 * Import a design system by URL or raw CSS.
 * Returns the server response (may include `token_count`).
 */
export async function importDesignSystem(
  value: string,
): Promise<{ token_count?: number }> {
  const isUrl = /^https?:\/\//i.test(value);
  const body = isUrl ? { url: value } : { css: value };

  const res = await fetch('/api/design-system', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Import failed');
  }

  return res.json();
}
