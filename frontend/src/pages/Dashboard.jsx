import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, LogOut, MessageSquare, Trash2, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const fileInputRef = useRef(null);
  const { user, logout } = useAuth();
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

    if (file.type !== 'application/pdf') {
      setError('Only PDF files are supported');
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

  const statusBadge = (status) => {
    if (status === 'ready')
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
          <CheckCircle2 size={12} /> Ready
        </span>
      );
    if (status === 'failed')
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-1 rounded-full">
          <XCircle size={12} /> Failed
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
        <Loader2 size={12} className="animate-spin" /> Processing
      </span>
    );
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-fuchsia-50/30">
        {/* Top nav */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-600 to-fuchsia-600 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-lg">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <MessageSquare size={16} className="text-white" />
            </div>
            <span className="font-semibold text-white">DocChat</span>
          </div>

          <div className="flex items-center gap-3">
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
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Your Documents</h1>
          <p className="text-slate-500 mb-8">Upload a PDF and start asking questions about it</p>

          {/* Upload card */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition group mb-8"
          >
            <input
              type="file"
              accept="application/pdf"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
            />
            {uploading ? (
              <>
                <Loader2 className="mx-auto mb-3 text-indigo-500 animate-spin" size={32} />
                <p className="text-slate-600 font-medium">Uploading...</p>
              </>
            ) : (
              <>
                <Upload className="mx-auto mb-3 text-slate-400 group-hover:text-indigo-500 transition" size={32} />
                <p className="text-slate-700 font-medium">Click to upload a PDF</p>
                <p className="text-slate-400 text-sm mt-1">Max 20MB</p>
              </>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-lg mb-6">{error}</p>
          )}

          {/* Documents list */}
          <div className="space-y-3">
            {documents.length === 0 && (
              <p className="text-center text-slate-400 py-10">No documents yet — upload one to get started.</p>
            )}
            {documents.map((doc) => (
              <div
                key={doc.id}
                onClick={() => doc.status === 'ready' && navigate(`/chat/${doc.id}`)}
                className={`flex items-center justify-between bg-white border border-slate-200 rounded-xl px-5 py-4 transition ${
                  doc.status === 'ready' ? 'cursor-pointer hover:border-indigo-300 hover:shadow-md' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                    <FileText size={18} className="text-indigo-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">{doc.filename}</p>
                    <p className="text-xs text-slate-400">
                      {doc.status === 'ready' ? `${doc.page_count} pages · ${doc.chunk_count} chunks` : doc.error_message || 'Processing...'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {statusBadge(doc.status)}
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
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full animate-fade-in">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Log out?</h3>
            <p className="text-sm text-slate-500 mb-6">Are you sure you want to log out of your account?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-lg font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
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
    </>
  );
}