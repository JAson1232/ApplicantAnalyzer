import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../lib/api';

function IconChat() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap
          ${isUser
            ? 'rounded-br-sm bg-gold-600 text-navy-950'
            : 'rounded-bl-sm bg-slate-700 text-slate-100'
          }`}
      >
        {msg.content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-slate-700 px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function ApplicationChat({ applicationId, token }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const nextMessages = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const data = await apiFetch(`/api/chat/applications/${applicationId}`, {
        method: 'POST',
        token,
        body: { messages: nextMessages }
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">

      {/* Expanded panel */}
      {open && (
        <div className="flex w-96 flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
             style={{ height: '520px' }}>

          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <IconChat />
              Application Assistant
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-100"
              aria-label="Minimise"
            >
              <IconChevronDown />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="text-center text-xs text-slate-500 mt-8">
                Ask anything about this applicant — the assistant has full access to the assessment and extracted documents.
              </p>
            )}
            {messages.map((msg, i) => (
              <Message key={i} msg={msg} />
            ))}
            {loading && <TypingIndicator />}
            {error && (
              <p className="rounded-lg bg-rose-950 px-3 py-2 text-xs text-rose-300">{error}</p>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-slate-700 p-3">
            <div className="flex items-end gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 focus-within:border-gold-500 transition-colors">
              <textarea
                ref={inputRef}
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none"
                placeholder="Ask a question…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ maxHeight: '120px' }}
                onInput={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
              />
              <button
                onClick={send}
                disabled={!input.trim() || loading}
                className="flex-shrink-0 rounded-lg bg-gold-500 p-1.5 text-navy-950 transition-opacity disabled:opacity-40 hover:opacity-80"
                aria-label="Send"
              >
                <IconSend />
              </button>
            </div>
            <p className="mt-1.5 text-center text-xs text-slate-600">Enter to send · Shift+Enter for new line</p>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full bg-gold-500 px-4 py-3 text-sm font-semibold text-navy-950 shadow-lg transition-all hover:bg-gold-400 active:scale-95"
      >
        <IconChat />
        {!open && 'Ask AI'}
      </button>
    </div>
  );
}
