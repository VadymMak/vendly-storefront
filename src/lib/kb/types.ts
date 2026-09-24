export interface KbSearchResult {
  title: string;
  heading: string;
  content: string;
  score: number;
}

export interface KbChatRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  sessionId: string;
  currentPage?: string;
  errorContext?: string;
  language?: string;
}
