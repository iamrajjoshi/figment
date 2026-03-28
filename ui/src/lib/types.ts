export interface Prompt {
  id: string;
  text: string;
  author: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  submittedAt: number;
  completedAt?: number;
  version?: number;
  error?: string;
}

export interface VersionMeta {
  version: number;
  prompt: string;
  author: string;
  timestamp: number;
}

export interface Participant {
  name: string;
  role: string;
  joinedAt: number;
}
