'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createThread,
  getMessages,
  getThreads,
  streamAssistantReply,
} from '@/lib/api';
import type { AssistantMessage, AssistantThread } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { WorkbookPicker } from '@/components/workbook-picker';

const prompts = [
  'Analyze my sales data and find the top 5 products.',
  'Build a pivot table to compare revenue by region.',
  'Explain what this formula does: =SUMIFS(...).',
  'Create a monthly report summary from this dataset.',
];

export function AssistantWorkspace() {
  const [workbookId, setWorkbookId] = useState('');
  const [threads, setThreads] = useState<AssistantThread[]>([]);
  const [threadId, setThreadId] = useState('');
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const sendingRef = useRef(false);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === threadId) ?? null,
    [threadId, threads],
  );

  useEffect(() => {
    void getThreads(workbookId || undefined)
      .then((payload) => {
        setThreads(payload.items);
        if (!threadId && payload.items[0]) {
          setThreadId(payload.items[0].id);
        }
      })
      .catch((err: Error) => setError(err.message));
  }, [workbookId]);

  useEffect(() => {
    if (!threadId) {
      setMessages([]);
      return;
    }

    void getMessages(threadId)
      .then((payload) => {
        setMessages(payload.messages);
      })
      .catch((err: Error) => setError(err.message));
  }, [threadId]);

  async function ensureThread() {
    if (threadId) {
      return threadId;
    }

    const payload = await createThread({
      title: workbookId ? 'Workbook chat' : 'New chat',
      workbookId: workbookId || undefined,
    });
    setThreads((current) => [payload.thread, ...current]);
    setThreadId(payload.thread.id);
    return payload.thread.id;
  }

  async function sendMessage(nextDraft?: string) {
    if (sendingRef.current) {
      return;
    }

    const content = (nextDraft ?? draft).trim();
    if (!content) {
      return;
    }

    sendingRef.current = true;
    setPending(true);
    setError('');

    const id = await ensureThread();
    setMessages((current) => [
      ...current,
      {
        id: `local-user-${Date.now()}`,
        threadId: id,
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      },
      {
        id: `local-ai-${Date.now()}`,
        threadId: id,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
      },
    ]);
    setDraft('');

    try {
      await streamAssistantReply(id, content, {
        onDelta(delta) {
          setMessages((current) => {
            const next = [...current];
            const last = next[next.length - 1];
            if (last?.role === 'assistant') {
              next[next.length - 1] = { ...last, content: last.content + delta };
            }
            return next;
          });
        },
        onComplete() {
          void getMessages(id).then((payload) => {
            setMessages(payload.messages);
          });
        },
      });
      const threadPayload = await getThreads(workbookId || undefined);
      setThreads(threadPayload.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Streaming failed');
    } finally {
      setPending(false);
      sendingRef.current = false;
    }
  }

  return (
    <>
      <PageHeader
        title="Spreadsheet Assistant"
        subtitle="Use the database-backed workbook context and stream AI answers into a chat workspace that feels close to the competitor’s core experience."
        badge={activeThread ? 'Active thread' : 'Chat mode'}
      />

      <div className="split">
        <div className="grid">
          <WorkbookPicker value={workbookId} onChange={setWorkbookId} title="Workbook context" />
          <div className="panel">
            <div className="button-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Conversations</h3>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  setThreadId('');
                  setMessages([]);
                }}
              >
                New chat
              </button>
            </div>
            <div className="list">
              {threads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  className="list-item"
                  style={{
                    textAlign: 'left',
                    borderColor:
                      thread.id === threadId ? 'rgba(217, 107, 43, 0.45)' : 'rgba(31, 45, 64, 0.08)',
                  }}
                  onClick={() => setThreadId(thread.id)}
                >
                  <div style={{ fontWeight: 700 }}>{thread.title}</div>
                  <div className="muted" style={{ fontSize: '0.88rem' }}>
                    {new Date(thread.updatedAt).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="message-list">
            {messages.length === 0 ? (
              <div className="empty-state">
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Start with a concrete spreadsheet task.</div>
                <div className="button-row">
                  {prompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="button button-ghost"
                      onClick={() => void sendMessage(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="message-bubble" data-role={message.role}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>
                    {message.role === 'user' ? 'You' : 'AI Assistant'}
                  </div>
                  <div className="markdown">{message.content || 'Thinking…'}</div>
                </div>
              ))
            )}
          </div>

          <div className="field" style={{ marginTop: 18, marginBottom: 10 }}>
            <label htmlFor="assistant-draft">Ask a workbook question</label>
            <textarea
              id="assistant-draft"
              className="textarea"
              value={draft}
              disabled={pending}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Explain the revenue dip in June, compare regions, or help build the next pivot."
            />
          </div>

          <div className="button-row">
            <button
              type="button"
              className="button button-primary"
              disabled={pending}
              onClick={() => void sendMessage()}
            >
              {pending ? 'Streaming response…' : 'Send message'}
            </button>
          </div>

          {error ? (
            <div className="empty-state" style={{ marginTop: 14, color: '#a14828' }}>
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
