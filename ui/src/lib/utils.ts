export const avatarColors = [
  '#5B8DEF', '#E06C87', '#D4A24C', '#4CAF7D', '#4ABDB5',
  '#9B7BD4', '#D46B6B', '#4CAAA8', '#D48A4C', '#6B8FD4',
];

export function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

export function truncate(text: string, len: number): string {
  if (!text) return '';
  return text.length > len ? text.slice(0, len) + '\u2026' : text;
}

export function relativeTime(ts: string | number | null | undefined): string {
  if (!ts) return '';
  const now = Date.now();
  const date = typeof ts === 'string' ? new Date(ts) : new Date(ts * 1000);
  const diff = Math.floor((now - date.getTime()) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return diff + 's ago';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
