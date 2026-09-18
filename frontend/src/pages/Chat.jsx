import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Loader2, FileText, Sun, Moon, Monitor } from 'lucide-react';
import client from '../api/client';
import { useTheme } from '../context/ThemeContext';

export default function Chat() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const { mode, setTheme } = useTheme();

  useEffect(() => {
    client.get(`/chats/${documentId}/history`).then((res) => {
      setMessages(res.data.messages);
    });
  }, [documentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const question = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setSending(true);

    try {
      const res = await client.post(`/chats/${documentId}/message`, { question });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.data.answer, sources: res.data.sources },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: err.response?.data?.error || 'Something went wrong.' },
      ]);
    } finally {
      setSending(false);
    }
  };

  const themeOptions = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'Default' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-fuchsia-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col">
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition">
            <ArrowLeft size={20} />
          </button>

          <div
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 cursor-pointer hover:opacity-70 transition"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center">
              <FileText size={16} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <span className="font-medium text-slate-900 dark:text-white">Chat with your document</span>
          </div>
        </div>

        {/* Theme Toggle */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-full p-1 gap-0.5">
          {themeOptions.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              title={label}
              className={`p-1.5 rounded-full transition-all ${
                mode === value
                  ? 'bg-white dark:bg-slate-500 text-indigo-600 dark:text-white shadow-sm'
                  : 'text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-white'
              }`}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8 max-w-3xl w-full mx-auto">
        {messages.length === 0 && (
          <div className="text-center text-slate-400 dark:text-slate-500 mt-20">
            <p>Ask anything about this document — answers will cite the source page.</p>
          </div>
        )}

        <div className="space-y-6">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  m.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-sm'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-sm'
                }`}
              >
                <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 space-y-1.5">
                    <p className="text-xs font-medium text-slate-400 dark:text-slate-500">Sources</p>
                    {m.sources.map((s, idx) => (
                      <div key={idx} className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-lg px-2.5 py-1.5">
                        <span className="font-medium text-indigo-600 dark:text-indigo-400">Page {s.pageNumber}</span> — {s.snippet}...
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-sm px-4 py-3">
                <Loader2 className="animate-spin text-slate-400" size={16} />
              </div>
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-4">
        <div className="max-w-3xl mx-auto flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about this document..."
            className="flex-1 px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}