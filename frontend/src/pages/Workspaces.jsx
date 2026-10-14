import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderKanban,
  Plus,
  FileText,
  Trash2,
  ArrowRight,
  Loader2,
  Sparkles,
  Layers,
  MessageSquare,
  LogOut,
  Sun,
  Moon,
  Monitor,
  X,
  FileSearch,
  BarChart3
} from 'lucide-react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Workspaces() {
  const [workspaces, setWorkspaces] = useState([]);
  const [availableDocs, setAvailableDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState([]);

  const { user, logout } = useAuth();
  const { mode, setTheme } = useTheme();
  const navigate = useNavigate();

  const themeOptions = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'Default' },
  ];

  const fetchWorkspaces = async () => {
    try {
      const res = await client.get('/workspaces');
      setWorkspaces(res.data);
    } catch (err) {
      console.error('Failed to load workspaces:', err);
    }
  };

  const fetchDocuments = async () => {
    try {
      const res = await client.get('/documents');
      setAvailableDocs(res.data.filter((d) => d.status === 'ready'));
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  };

  useEffect(() => {
    Promise.all([fetchWorkspaces(), fetchDocuments()]).finally(() => {
      setLoading(false);
    });
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    setError('');

    try {
      await client.post('/workspaces', {
        name: name.trim(),
        description: description.trim(),
        documentIds: selectedDocIds,
      });

      setName('');
      setDescription('');
      setSelectedDocIds([]);
      setShowCreateModal(false);
      await fetchWorkspaces();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this workspace?')) return;

    try {
      await client.delete(`/workspaces/${id}`);
      setWorkspaces((prev) => prev.filter((w) => w.id !== id));
    } catch (err) {
      console.error('Failed to delete workspace:', err);
    }
  };

  const toggleDocSelection = (docId) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-fuchsia-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col font-sans">
      {/* Top Nav */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-600 to-fuchsia-600 dark:from-indigo-900 dark:via-indigo-900 dark:to-fuchsia-900 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-lg">
        <div className="flex items-center gap-6">
          <div
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <MessageSquare size={16} className="text-white" />
            </div>
            <span className="font-semibold text-white">DocChat</span>
          </div>

          {/* Navigation Tabs */}
          <div className="hidden sm:flex items-center bg-black/10 backdrop-blur-sm p-1 rounded-xl gap-1">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-3 py-1 rounded-lg text-xs font-semibold text-white/80 hover:text-white transition"
            >
              My Documents
            </button>
            <button
              className="px-3 py-1 rounded-lg text-xs font-semibold bg-white text-indigo-700 shadow-sm"
            >
              Workspaces (Cross-Doc)
            </button>
            <button
              onClick={() => navigate('/analytics')}
              className="px-3 py-1 rounded-lg text-xs font-semibold text-white/80 hover:text-white flex items-center gap-1.5 transition"
            >
              <BarChart3 size={13} />
              Analytics
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Theme Toggle */}
          <div className="flex items-center bg-white/15 backdrop-blur-sm border border-white/20 rounded-full p-1 gap-0.5">
            {themeOptions.map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                title={label}
                className={`p-1.5 rounded-full transition-all ${
                  mode === value ? 'bg-white/25 text-white shadow-sm' : 'text-white/60 hover:text-white/90'
                }`}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full pl-1.5 pr-4 py-1.5">
            <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-indigo-600 text-xs font-bold shrink-0">
              {(user?.firstName?.[0] || user?.email?.[0] || '?').toUpperCase()}
            </div>
            <span className="text-sm font-medium text-white hidden md:inline">
              {user?.firstName ? `${user.firstName} ${user.lastName}` : user?.email}
            </span>
          </div>

          <button
            onClick={() => logout()}
            className="flex items-center gap-1.5 text-sm font-medium text-white/90 hover:text-red-100 hover:bg-red-500/40 px-3 py-2 rounded-full transition"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-5xl mx-auto px-6 py-10 w-full flex-1 flex flex-col">
        {/* Header Title & Create Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-2.5 py-0.5 rounded-full">
                Module 9 · Multi-Doc RAG
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white">
              Research Workspaces
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Group multiple files together to run unified semantic Q&A and side-by-side comparative analysis.
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-700 hover:to-fuchsia-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow transition shrink-0"
          >
            <Plus size={16} />
            <span>New Workspace</span>
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="py-20 text-center">
            <Loader2 size={32} className="animate-spin text-indigo-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Loading workspaces...</p>
          </div>
        )}

        {/* Workspaces Grid */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {workspaces.length === 0 ? (
              <div className="col-span-full border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-12 text-center bg-white/40 dark:bg-slate-900/40">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center mx-auto mb-4 text-indigo-600 dark:text-indigo-400">
                  <FolderKanban size={28} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                  No Workspaces Created Yet
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto mb-6">
                  Create your first workspace to connect related documents (e.g. Unit 1 + Unit 2 notes) and ask questions across all of them simultaneously.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-5 py-2.5 rounded-xl shadow transition"
                >
                  <Plus size={16} />
                  <span>Create Workspace</span>
                </button>
              </div>
            ) : (
              workspaces.map((ws) => (
                <div
                  key={ws.id}
                  onClick={() => navigate(`/workspace/${ws.id}`)}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 rounded-2xl p-6 shadow-xs hover:shadow-md transition cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 text-white flex items-center justify-center shadow-xs shrink-0">
                          <FolderKanban size={20} />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-white text-base group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                            {ws.name}
                          </h3>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500">
                            Created {new Date(ws.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleDelete(ws.id, e)}
                        className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg transition"
                        title="Delete workspace"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {ws.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 line-clamp-2">
                        {ws.description}
                      </p>
                    )}

                    {/* Attached Files Badges */}
                    <div className="mb-4 space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                        <span className="flex items-center gap-1 font-semibold">
                          <Layers size={13} className="text-indigo-500" />
                          <span>Attached Documents: {ws.document_count}</span>
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {ws.documents?.slice(0, 3).map((d) => (
                          <span
                            key={d.id}
                            className="text-[11px] bg-slate-100 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md truncate max-w-[150px] flex items-center gap-1"
                          >
                            <FileText size={10} className="text-indigo-500 shrink-0" />
                            <span className="truncate">{d.filename}</span>
                          </span>
                        ))}
                        {ws.document_count > 3 && (
                          <span className="text-[11px] bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-md font-medium">
                            +{ws.document_count - 3} more
                          </span>
                        )}
                        {ws.document_count === 0 && (
                          <span className="text-[11px] text-slate-400 italic">No files linked yet</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-between text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    <span>Enter Workspace</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <FolderKanban size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Create Research Workspace
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Group multiple files for multi-document RAG
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1"
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 dark:bg-red-950/60 p-3 rounded-xl mb-4">
                {error}
              </p>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Workspace Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., MCA Semester 3 Project Notes"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g., Comparing textbook chapters with exam questions"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Attach existing documents */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Attach Documents ({selectedDocIds.length} selected)
                </label>

                {availableDocs.length === 0 ? (
                  <p className="text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl">
                    No ready documents available. You can create the workspace now and upload/attach documents later.
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 dark:border-slate-700 rounded-xl p-2 bg-slate-50/50 dark:bg-slate-900/50">
                    {availableDocs.map((doc) => {
                      const isSelected = selectedDocIds.includes(doc.id);
                      return (
                        <div
                          key={doc.id}
                          onClick={() => toggleDocSelection(doc.id)}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition ${
                            isSelected
                              ? 'bg-indigo-100/70 dark:bg-indigo-950/80 text-indigo-900 dark:text-indigo-200 font-medium'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <FileText size={14} className="text-indigo-500 shrink-0" />
                            <span className="truncate">{doc.filename}</span>
                          </div>
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'border-slate-300 dark:border-slate-600'
                            }`}
                          >
                            {isSelected && <Check size={10} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !name.trim()}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow transition disabled:opacity-50"
                >
                  {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  <span>{creating ? 'Creating...' : 'Create Workspace'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
