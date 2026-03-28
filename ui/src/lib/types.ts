export interface Prompt {
  id: string;
  text: string;
  author: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  submittedAt: string;
  completedAt?: string;
  version?: number;
  error?: string;
}

export interface VersionMeta {
  version: number;
  prompt: string;
  author: string;
  timestamp: string;
}

export interface Participant {
  name: string;
  role: string;
  joinedAt: string;
}
