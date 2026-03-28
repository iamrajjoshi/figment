import { writable, get } from 'svelte/store';
import type { Prompt, VersionMeta } from './types';
import type { Annotation } from './annotation-types';

// --- Auth ---

export const token = writable<string>('');
export const role = writable<'editor' | 'viewer'>('viewer');

/**
 * Read token from URL `?t=` param or localStorage, set token + role stores,
 * then strip the `?t=` param from the URL so it doesn't linger.
 */
export function extractToken(): void {
  const params = new URLSearchParams(window.location.search);
  let t = params.get('t') || '';

  // Persist so page refresh / SSE reconnect still works
  if (t) {
    localStorage.setItem('figment-token', t);
  } else {
    t = localStorage.getItem('figment-token') || '';
  }

  token.set(t);

  if (!t) return;

  // Decode role from the token payload (base64url-encoded JSON before the first '.')
  try {
    const payloadPart = t.split('.')[0];
    const padded = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded);
    const payload = JSON.parse(json);
    role.set(payload.role === 'editor' ? 'editor' : 'viewer');
  } catch {
    role.set('viewer');
  }

  // Strip ?t= from the URL
  if (params.has('t')) {
    params.delete('t');
    let clean = window.location.pathname;
    if (params.toString()) clean += '?' + params.toString();
    window.history.replaceState({}, '', clean);
  }
}

/**
 * Return an Authorization header using the current token value.
 */
export function authHeaders(): Record<string, string> {
  return { Authorization: 'Bearer ' + get(token) };
}

// --- Session ---

export const sessionName = writable<string>('');
export const currentVersion = writable<number>(0);
export const previewVersion = writable<number | null>(null);
export const hasPrototype = writable<boolean>(false);

// --- Queue & History ---

export const queue = writable<Prompt[]>([]);
export const versions = writable<VersionMeta[]>([]);
export const participants = writable<string[]>([]);
export const toolProgressMap = writable<Record<string, string>>({});

// --- Author name (synced to localStorage) ---

export const authorName = writable<string>(
  localStorage.getItem('figment-name') || '',
);

authorName.subscribe((value) => {
  if (value) {
    localStorage.setItem('figment-name', value);
    // Keep legacy key in sync for backwards compat
    localStorage.setItem('figment-author', value);
  }
});

// --- Annotations ---

export const annotations = writable<Annotation[]>([]);
export const activeTool = writable<string | null>(null);

// --- UI State ---

export const showInviteModal = writable<boolean>(false);
export const showSettingsModal = writable<boolean>(false);

// --- Toast ---

export interface ToastMessage {
  text: string;
  isError: boolean;
  visible: boolean;
}

export const toast = writable<ToastMessage>({ text: '', isError: false, visible: false });

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(msg: string, isError: boolean = false): void {
  if (toastTimer) clearTimeout(toastTimer);
  toast.set({ text: msg, isError, visible: true });
  toastTimer = setTimeout(() => {
    toast.update((t) => ({ ...t, visible: false }));
  }, 3500);
}
