import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Send, Loader2, FileText, Sun, Moon, Monitor, GraduationCap, Sparkles, Download, ChevronDown, FileDown, Network } from 'lucide-react';
import client from '../api/client';
import { useTheme } from '../context/ThemeContext';
import SummaryModal from '../components/SummaryModal';
import { exportChatToPdf, exportChatToMarkdown, exportStudyGuideToPdf } from '../utils/exportUtils';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';
import VoiceMicButton from '../components/VoiceMicButton';
import AudioMessagePlayer from '../components/AudioMessagePlayer';

export default function Chat() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [documentInfo, setDocumentInfo] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportingStudyGuide, setExportingStudyGuide] = useState(false);
  const bottomRef = useRef(null);
  const { mode, setTheme } = useTheme();
  const voice = useVoiceAssistant();

  useEffect(() => {
    if (location.state?.initialQuestion) {
      setInput(location.state.initialQuestion);
    }
  }, [location.state]);

  useEffect(() => {
    client.get('/documents').then((res) => {
      const doc = res.data.find((d) => d.id === documentId);
      if (doc) setDocumentInfo(doc);
    });
  }, [documentId]);

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

  const handleExportStudyGuide = async () => {
    setExportingStudyGuide(true);
    try {
      let summaryData = null;
      try {
        const sumRes = await client.get(`/summaries/${documentId}`);
        if (sumRes.data.cached) summaryData = sumRes.data.summary;
      } catch (err) {
        // summary not yet generated
      }

      let quizData = null;
      try {
        const qRes = await client.get(`/quiz/document/${documentId}`);
        if (qRes.data && qRes.data.length > 0) {
          const detailRes = await client.get(`/quiz/${qRes.data[0].id}`);
          quizData = detailRes.data;
        }
      } catch (err) {
        // quiz not yet generated
      }

      exportStudyGuideToPdf(documentInfo?.filename || 'Document', summaryData, quizData);
    } catch (err) {
      console.error('Failed to export study guide:', err);
    } finally {
      setExportingStudyGuide(false);
      setShowExportMenu(false);
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
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center shrink-0">
              <FileText size={16} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[180px] sm:max-w-xs">
              {documentInfo?.filename || 'Document Chat'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Summary Modal Toggle */}
          <button
            onClick={() => setShowSummary(true)}
            className="flex items-center gap-1.5 text-xs font-semibold bg-fuchsia-50 hover:bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/80 dark:hover:bg-fuchsia-900 dark:text-fuchsia-300 border border-fuchsia-200/60 dark:border-fuchsia-800/80 px-2.5 py-1.5 rounded-lg transition"
            title="View AI Document Insights & Summary"
          >
            <Sparkles size={14} />
            <span className="hidden sm:inline">Summary</span>
          </button>

          {/* Quiz & Viva Prep */}
          <button
            onClick={() => navigate(`/quiz/${documentId}`)}
            className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:hover:bg-indigo-900 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/80 px-2.5 py-1.5 rounded-lg transition"
            title="Take Quiz & Viva Prep"
          >
            <GraduationCap size={14} />
            <span className="hidden sm:inline">Quiz & Viva</span>
          </button>

          {/* AI Knowledge Graph & Concept Mind Map */}
          <button
            onClick={() => navigate(`/graph/${documentId}`)}
            className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:hover:bg-emerald-900 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/80 px-2.5 py-1.5 rounded-lg transition"
            title="Interactive AI Knowledge Graph & Concept Mind Map"
          >
            <Network size={14} />
            <span className="hidden sm:inline">Concept Graph</span>
          </button>

          {/* Export Dropdown Menu */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 px-2.5 py-1.5 rounded-lg transition"
              title="Export Chat & Notes"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Export</span>
              <ChevronDown size={12} className={`transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-2 z-30 animate-fade-in text-xs space-y-1">
                <button
                  onClick={() => {
                    exportChatToPdf(documentInfo?.filename, messages);
                    setShowExportMenu(false);
                  }}
                  disabled={messages.length === 0}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-800 dark:text-slate-200 transition disabled:opacity-40"
                >
                  <FileDown size={15} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <div>
                    <p className="font-semibold">Export Chat to PDF</p>
                    <p className="text-[10px] text-slate-400">Includes answers & source citations</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    exportChatToMarkdown(documentInfo?.filename, messages);
                    setShowExportMenu(false);
                  }}
                  disabled={messages.length === 0}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-800 dark:text-slate-200 transition disabled:opacity-40"
                >
                  <Download size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <p className="font-semibold">Export to Markdown (.md)</p>
                    <p className="text-[10px] text-slate-400">Raw markdown text format</p>
                  </div>
                </button>

                <div className="border-t border-slate-100 dark:border-slate-700/80 my-1" />

                <button
                  onClick={handleExportStudyGuide}
                  disabled={exportingStudyGuide}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-fuchsia-50 dark:hover:bg-fuchsia-950/60 text-slate-800 dark:text-slate-200 transition disabled:opacity-40"
                >
                  <Sparkles size={15} className="text-fuchsia-600 dark:text-fuchsia-400 shrink-0" />
                  <div>
                    <p className="font-semibold">
                      {exportingStudyGuide ? 'Generating Booklet...' : 'Export Complete Study Guide'}
                    </p>
                    <p className="text-[10px] text-slate-400">Summary + Glossary + Key Points</p>
                  </div>
                </button>
              </div>
            )}
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

                {/* Voice Read Aloud for Assistant Answers */}
                {m.role === 'assistant' && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                    <AudioMessagePlayer
                      messageId={m.id || i}
                      content={m.content}
                      isSpeaking={voice.isSpeaking}
                      isPaused={voice.isPaused}
                      activeMessageId={voice.activeMessageId}
                      speechRate={voice.speechRate}
                      setSpeechRate={voice.setSpeechRate}
                      onSpeak={voice.speakText}
                      onPause={voice.pauseSpeech}
                      onResume={voice.resumeSpeech}
                      onStop={voice.stopSpeech}
                    />
                  </div>
                )}

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
        <div className="max-w-3xl mx-auto flex items-center gap-2 sm:gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              voice.isListening
                ? 'Listening to speech... (Click mic to stop)'
                : 'Ask a question about this document...'
            }
            className={`flex-1 px-4 py-2.5 border rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition ${
              voice.isListening
                ? 'border-red-400 dark:border-red-500 ring-2 ring-red-400/20'
                : 'border-slate-300 dark:border-slate-600'
            }`}
          />
          <VoiceMicButton
            isListening={voice.isListening}
            onStart={() => voice.startListening((text) => setInput(text))}
            onStop={voice.stopListening}
            sttSupported={voice.sttSupported}
            errorMessage={voice.sttError}
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="bg-indigo-600 text-white p-2.5 sm:px-4 sm:py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition shrink-0"
            title="Send Question"
          >
            <Send size={18} />
          </button>
        </div>
      </form>

      {showSummary && (
        <SummaryModal
          documentId={documentId}
          onClose={() => setShowSummary(false)}
        />
      )}
    </div>
  );
}