import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, LogOut, MessageSquare, Trash2, Loader2, CheckCircle2, XCircle, Eye, X, Sun, Moon, Monitor } from 'lucide-react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Dashboard() {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const fileInputRef = useRef(null);
  const { user, logout } = useAuth();
  const { mode, setTheme } = useTheme();
  const navigate = useNavigate();

  const fetchDocuments = async () => {
    try {
      const res = await client.get('/documents');
      setDocuments(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDocuments();
    const interval = setInterval(fetchDocuments, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
    ];

    if (!allowedTypes.includes(file.type)) {
      setError('Unsupported file type. Allowed: PDF, DOCX, XLSX, XLS, PPTX, TXT');
      return;
    }

    setError('');
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      await client.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await fetchDocuments();
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    try {
      await client.delete(`/documents/${id}`);
      setDocuments((docs) => docs.filter((d) => d.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handlePreview = async (id, e) => {
    e.stopPropagation();
    setPreviewLoading(true);
    try {
      const res = await client.get(`/documents/${id}/content`);
      setPreviewDoc(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load document content');
    } finally {
      setPreviewLoading(false);
    }
  };

  const themeOptions = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'Default' },
  ];

  const statusBadge = (status) => {
    if (status === 'ready')
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950 px-2 py-1 rounded-full">
          <CheckCircle2 size={12} /> Ready
        </span>
      );
    if (status === 'failed')
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950 px-2 py-1 rounded-full">
          <XCircle size={12} /> Failed
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950 px-2 py-1 rounded-full">
        <Loader2 size={12} className="animate-spin" /> Processing
      </span>
    );
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-fuchsia-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        {/* Top nav */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-600 to-fuchsia-600 dark:from-indigo-900 dark:via-indigo-900 dark:to-fuchsia-900 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-lg">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <MessageSquare size={16} className="text-white" />
            </div>
            <span className="font-semibold text-white">DocChat</span>
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
                    mode === value
                      ? 'bg-white/25 text-white shadow-sm'
                      : 'text-white/60 hover:text-white/90'
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
              <span className="text-sm font-medium text-white">
                {user?.firstName ? `${user.firstName} ${user.lastName}` : user?.email}
              </span>
            </div>

            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-white/90 hover:text-red-100 hover:bg-red-500/40 px-3 py-2 rounded-full transition"
            >
              <LogOut size={15} /> Logout
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-10">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Your Documents</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-8">Upload a document and start asking questions about it</p>

          {/* Upload card */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl p-10 text-center cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition group mb-8"
          >
            <input
              type="file"
              accept=".pdf,.docx,.xlsx,.xls,.pptx,.txt"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
            />
            {uploading ? (
              <>
                <Loader2 className="mx-auto mb-3 text-indigo-500 animate-spin" size={32} />
                <p className="text-slate-600 dark:text-slate-300 font-medium">Uploading...</p>
              </>
            ) : (
              <>
                <Upload className="mx-auto mb-3 text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 transition" size={32} />
                <p className="text-slate-700 dark:text-slate-200 font-medium">Click to upload a document</p>
                <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">PDF, DOCX, XLSX, PPTX, TXT · Max 20MB</p>
              </>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 px-4 py-2.5 rounded-lg mb-6">{error}</p>
          )}

          {/* Documents list */}
          <div className="space-y-3">
            {documents.length === 0 && (
              <p className="text-center text-slate-400 dark:text-slate-500 py-10">No documents yet — upload one to get started.</p>
            )}
            {documents.map((doc) => (
              <div
                key={doc.id}
                onClick={() => doc.status === 'ready' && navigate(`/chat/${doc.id}`)}
                className={`flex items-center justify-between bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-4 transition ${doc.status === 'ready' ? 'cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md' : ''
                  }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center shrink-0">
                    <FileText size={18} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white truncate">{doc.filename}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {doc.status === 'ready' ? `${doc.page_count} pages · ${doc.chunk_count} chunks` : doc.error_message || 'Processing...'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {statusBadge(doc.status)}
                  {doc.status === 'ready' && (
                    <button
                      onClick={(e) => handlePreview(doc.id, e)}
                      className="text-slate-400 hover:text-indigo-500 transition p-1"
                      title="View content"
                    >
                      <Eye size={16} />
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDelete(doc.id, e)}
                    className="text-slate-400 hover:text-red-500 transition p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 max-w-sm w-full animate-fade-in">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Log out?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Are you sure you want to log out of your account?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-lg font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => { logout(); navigate('/login'); }}
                className="flex-1 py-2.5 rounded-lg font-medium text-white bg-red-600 hover:bg-red-700 transition"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Content Preview Modal */}
      {(previewDoc || previewLoading) && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col animate-fade-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center shrink-0">
                  <FileText size={18} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                    {previewDoc?.filename || 'Loading...'}
                  </h3>
                  {previewDoc && (
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {previewDoc.pages.length} {previewDoc.pages.length === 1 ? 'page' : 'pages'}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {previewLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="animate-spin text-indigo-500" size={28} />
                  <span className="ml-3 text-slate-500 dark:text-slate-400">Loading content...</span>
                </div>
              ) : previewDoc?.pages?.length > 0 ? (
                <div className="space-y-6">
                  {previewDoc.pages.map((page) => (
                    <div key={page.pageNumber}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2.5 py-1 rounded-full">
                          Page {page.pageNumber}
                        </span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                        <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 font-sans leading-relaxed">
                          {page.text}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-slate-400 dark:text-slate-500 py-10">No content available.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}