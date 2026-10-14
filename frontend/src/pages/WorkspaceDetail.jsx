import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FolderKanban,
  FileText,
  Send,
  Loader2,
  Sparkles,
  Layers,
  Scale,
  Plus,
  Trash2,
  Sun,
  Moon,
  Monitor,
  Check,
  X,
  FileDown,
  Download,
  AlertCircle,
  HelpCircle,
  FileSearch,
  BookOpen
} from 'lucide-react';
import client from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { exportChatToPdf, exportChatToMarkdown } from '../utils/exportUtils';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';
import VoiceMicButton from '../components/VoiceMicButton';
import AudioMessagePlayer from '../components/AudioMessagePlayer';

export default function WorkspaceDetail() {
  const { id: workspaceId } = useParams();
  const navigate = useNavigate();
  const { mode, setTheme } = useTheme();
  const voice = useVoiceAssistant();

  const [workspace, setWorkspace] = useState(null);
  const [allUserDocs, setAllUserDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Active view tab: 'chat' | 'compare'
  const [activeTab, setActiveTab] = useState('chat');

  // Multi-Doc Chat State
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  // Document Comparison State
  const [docAId, setDocAId] = useState('');
  const [docBId, setDocBId] = useState('');
  const [comparisonType, setComparisonType] = useState('differences');
  const [comparing, setComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState(null);

  // Manage Documents Modal State
  const [showManageModal, setShowManageModal] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [savingDocs, setSavingDocs] = useState(false);

  const themeOptions = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'Default' },
  ];

  const fetchWorkspace = async () => {
    try {
      const res = await client.get(`/workspaces/${workspaceId}`);
      setWorkspace(res.data);
      const attachedIds = (res.data.documents || []).map((d) => d.id);
      setSelectedDocIds(attachedIds);

      // Default comparison select options if >= 2 documents
      if (attachedIds.length >= 2 && !docAId && !docBId) {
        setDocAId(attachedIds[0]);
        setDocBId(attachedIds[1]);
      }
    } catch (err) {
      console.error('Failed to load workspace:', err);
      setError('Failed to load workspace details');
    }
  };

  const fetchAllDocs = async () => {
    try {
      const res = await client.get('/documents');
      setAllUserDocs(res.data.filter((d) => d.status === 'ready'));
    } catch (err) {
      console.error('Failed to load user documents:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await client.get(`/workspaces/${workspaceId}/history`);
      setMessages(res.data.messages || []);
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
  };

  useEffect(() => {
    Promise.all([fetchWorkspace(), fetchAllDocs(), fetchHistory()]).finally(() => {
      setLoading(false);
    });
  }, [workspaceId]);

  useEffect(() => {
    if (activeTab === 'chat') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim() || sending) return;

    const question = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setSending(true);

    try {
      const res = await client.post(`/workspaces/${workspaceId}/message`, { question });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.data.answer, sources: res.data.sources },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: err.response?.data?.error || 'Failed to generate cross-document answer.',
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleRunComparison = async () => {
    if (!docAId || !docBId || docAId === docBId) {
      setError('Please select two distinct documents to compare.');
      return;
    }

    setComparing(true);
    setError('');
    setComparisonResult(null);

    try {
      const res = await client.post(`/workspaces/${workspaceId}/compare`, {
        docAId,
        docBId,
        comparisonType,
      });
      setComparisonResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to compare documents.');
    } finally {
      setComparing(false);
    }
  };

  const handleSaveDocs = async () => {
    setSavingDocs(true);
    try {
      const res = await client.post(`/workspaces/${workspaceId}/documents`, {
        documentIds: selectedDocIds,
      });
      setWorkspace((prev) => ({
        ...prev,
        documents: res.data.documents,
      }));
      setShowManageModal(false);
    } catch (err) {
      console.error('Failed to update documents:', err);
    } finally {
      setSavingDocs(false);
    }
  };

  const toggleDocSelection = (docId) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const attachedDocs = workspace?.documents || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-fuchsia-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col font-sans">
      {/* Top Header Navbar */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/workspaces')}
            className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white p-1 rounded-lg transition shrink-0"
            title="Back to Workspaces"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <FolderKanban size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-slate-900 dark:text-white text-base truncate">
                  {workspace?.name || 'Workspace'}
                </h2>
                <span className="text-xs bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold px-2 py-0.5 rounded-full border border-indigo-200/60 dark:border-indigo-800/80 shrink-0">
                  {attachedDocs.length} Docs Linked
                </span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-sm">
                {workspace?.description || 'Cross-document intelligence & comparison engine'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Manage Attached Files Button */}
          <button
            onClick={() => setShowManageModal(true)}
            className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/80 px-3 py-1.5 rounded-lg transition"
          >
            <Layers size={14} />
            <span className="hidden sm:inline">Manage Files ({attachedDocs.length})</span>
          </button>

          {/* Export Transcript to PDF */}
          <button
            onClick={() => exportChatToPdf(workspace?.name, messages)}
            disabled={messages.length === 0}
            className="flex items-center gap-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg transition disabled:opacity-40"
            title="Export Workspace Q&A to PDF"
          >
            <FileDown size={14} />
            <span className="hidden md:inline">Export PDF</span>
          </button>

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
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'
                }`}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mode Selector Tabs (Unified Chat vs Comparative Analysis) */}
      <div className="max-w-4xl w-full mx-auto px-6 pt-6 pb-2">
        <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center gap-1 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
                activeTab === 'chat'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles size={16} />
              <span>Multi-Document Q&A Chat</span>
            </button>

            <button
              onClick={() => setActiveTab('compare')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
                activeTab === 'compare'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Scale size={16} />
              <span>Side-by-Side Comparison</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 px-2">
            <span>Linked: {attachedDocs.map((d) => d.filename).join(', ') || 'No files'}</span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: MULTI-DOCUMENT UNIFIED CHAT
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col max-w-4xl w-full mx-auto px-6 pb-6">
          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto py-6 space-y-6">
            {messages.length === 0 && (
              <div className="text-center py-16 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400 shadow-inner">
                  <Sparkles size={28} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Cross-Document Intelligence Ready
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                    Ask questions across all {attachedDocs.length} documents in this workspace. Answers will synthesize facts and cite the exact source files and pages.
                  </p>
                </div>

                {/* Quick Prompt Suggestions */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  {[
                    'Synthesize the main conclusions across all attached documents',
                    'What are the key technical concepts described in these files?',
                    'Compare the core methodologies mentioned in these documents',
                  ].map((suggestion, sIdx) => (
                    <button
                      key={sIdx}
                      onClick={() => {
                        setInput(suggestion);
                      }}
                      className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-full transition"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-5 py-4 ${
                    m.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-sm shadow-sm'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-sm shadow-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</p>

                  {/* Read Aloud Voice Button for Assistant Response */}
                  {m.role === 'assistant' && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                      <AudioMessagePlayer
                        messageId={m.id || mIdx}
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

                  {/* Multi-Source Citations */}
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/80 space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Multi-Document Sources Cited:
                      </p>
                      <div className="grid grid-cols-1 gap-1.5">
                        {m.sources.map((s, sIdx) => (
                          <div
                            key={sIdx}
                            className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800 rounded-xl px-3 py-2 flex flex-col gap-1"
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                                <FileText size={12} />
                                {s.filename} (Page {s.pageNumber})
                              </span>
                              {s.relevanceScore && (
                                <span className="text-slate-400 text-[10px]">
                                  Match: {Math.round(s.relevanceScore * 100)}%
                                </span>
                              )}
                            </div>
                            <p className="italic text-slate-500 dark:text-slate-400 line-clamp-2">
                              "{s.snippet}..."
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-sm px-5 py-4 shadow-xs flex items-center gap-3">
                  <Loader2 className="animate-spin text-indigo-500" size={18} />
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Synthesizing answers across {attachedDocs.length} documents...
                  </span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Chat Input Bar */}
          <form onSubmit={handleSend} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-2 shadow-sm flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                voice.isListening
                  ? 'Listening across workspace documents... (Click mic to stop)'
                  : `Ask a question across all ${attachedDocs.length} workspace documents...`
              }
              className={`flex-1 px-4 py-2.5 bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none ${
                voice.isListening ? 'italic font-medium text-indigo-600 dark:text-indigo-400' : ''
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
              disabled={sending || !input.trim() || attachedDocs.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl disabled:opacity-40 transition shrink-0"
              title="Send Cross-Document Question"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: SIDE-BY-SIDE DOCUMENT COMPARISON ("DIFF & COMPARE")
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'compare' && (
        <div className="flex-1 max-w-4xl w-full mx-auto px-6 py-4 space-y-6">
          {/* Comparison Control Card */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm space-y-5">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Scale size={18} className="text-indigo-600 dark:text-indigo-400" />
                <span>Side-by-Side Document Comparator</span>
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                Select two documents from this workspace to highlight differences, common findings, or create a comparison matrix.
              </p>
            </div>

            {attachedDocs.length < 2 ? (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center gap-3 text-amber-800 dark:text-amber-200 text-xs">
                <AlertCircle size={18} className="shrink-0 text-amber-600" />
                <div>
                  <p className="font-semibold">At least 2 documents are required for comparison.</p>
                  <button
                    onClick={() => setShowManageModal(true)}
                    className="underline mt-1 font-bold"
                  >
                    Click here to attach more documents
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Select Doc A */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                      Document A (Reference)
                    </label>
                    <select
                      value={docAId}
                      onChange={(e) => setDocAId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {attachedDocs.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.filename} ({d.page_count} pages)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Select Doc B */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                      Document B (Comparison Target)
                    </label>
                    <select
                      value={docBId}
                      onChange={(e) => setDocBId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {attachedDocs.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.filename} ({d.page_count} pages)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Comparison Type Pills */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl text-xs font-medium">
                    {[
                      { id: 'differences', label: 'Key Differences' },
                      { id: 'commonground', label: 'Common Findings' },
                      { id: 'matrix', label: 'Comparison Matrix' },
                    ].map((type) => (
                      <button
                        key={type.id}
                        onClick={() => setComparisonType(type.id)}
                        className={`px-3 py-1.5 rounded-lg transition ${
                          comparisonType === type.id
                            ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleRunComparison}
                    disabled={comparing || !docAId || !docBId || docAId === docBId}
                    className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-700 hover:to-fuchsia-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow transition disabled:opacity-50"
                  >
                    {comparing ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Running Comparative Analysis...</span>
                      </>
                    ) : (
                      <>
                        <Scale size={14} />
                        <span>Compare Documents</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs p-4 rounded-xl flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError('')} className="font-bold">✕</button>
            </div>
          )}

          {/* Comparison Results Card */}
          {comparisonResult && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 md:p-8 shadow-sm space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <h4 className="font-bold text-slate-900 dark:text-white text-base">
                    Comparative Analysis: {comparisonResult.docA} vs {comparisonResult.docB}
                  </h4>
                </div>
                <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded">
                  {comparisonResult.comparisonType}
                </span>
              </div>

              <div className="prose dark:prose-invert max-w-none text-sm text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                {comparisonResult.comparison}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MANAGE ATTACHED DOCUMENTS MODAL
         ───────────────────────────────────────────────────────────── */}
      {showManageModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700 mb-4">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Manage Attached Files
                </h3>
              </div>
              <button
                onClick={() => setShowManageModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Select which uploaded files belong to <strong>{workspace?.name}</strong>. The AI will search across all checked files.
            </p>

            <div className="max-h-64 overflow-y-auto space-y-2 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 bg-slate-50/50 dark:bg-slate-900/50 mb-6">
              {allUserDocs.length === 0 ? (
                <p className="text-xs text-slate-400 italic p-3 text-center">
                  No uploaded documents available.
                </p>
              ) : (
                allUserDocs.map((doc) => {
                  const isChecked = selectedDocIds.includes(doc.id);
                  return (
                    <div
                      key={doc.id}
                      onClick={() => toggleDocSelection(doc.id)}
                      className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition ${
                        isChecked
                          ? 'bg-indigo-100/70 dark:bg-indigo-950/80 text-indigo-900 dark:text-indigo-200 font-medium'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate pr-2">
                        <FileText size={15} className="text-indigo-500 shrink-0" />
                        <div className="truncate">
                          <p className="truncate font-medium">{doc.filename}</p>
                          <p className="text-[10px] text-slate-400">{doc.page_count} pages</p>
                        </div>
                      </div>

                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          isChecked
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {isChecked && <Check size={11} />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowManageModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDocs}
                disabled={savingDocs}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow transition disabled:opacity-50"
              >
                {savingDocs ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                <span>{savingDocs ? 'Saving...' : 'Save Workspace Files'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
