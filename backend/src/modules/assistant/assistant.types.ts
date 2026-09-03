export interface AssistantThreadRecord {
  id: string;
  userId: string;
  title: string;
  workbookId?: string;
  updatedAt: string;
}

export interface AssistantMessageRecord {
  id: string;
  threadId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  aiRequestId?: string;
}
