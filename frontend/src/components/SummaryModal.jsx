import React, { useEffect, useState } from 'react';
import {
  X,
  Sparkles,
  BookOpen,
  Clock,
  Layers,
  Check,
  Copy,
  RotateCcw,
  Loader2,
  FileText,
  Bookmark,
  CheckCircle2,
  Info,
  Flame,
  AlertCircle,
  Download,
  FileDown
} from 'lucide-react';
import client from '../api/client';
import { exportStudyGuideToPdf, downloadTextFile } from '../utils/exportUtils';

export default function SummaryModal({ documentId, filename, onClose }) {
  const [activeTab, setActiveTab] = useState('executive'); // 'executive' | 'takeaways' | 'glossary'
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState('');
  const [summaryData, setSummaryData] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (documentId) {
      loadSummary(false);
    }
  }, [documentId]);

  const loadSummary = async (force = false) => {
    if (force) setRegenerating(true);
    else setLoading(true);
    setError('');

    try {
      // First attempt to get cached summary if not forcing
      if (!force) {
        const getRes = await client.get(`/summaries/${documentId}`);
        if (getRes.data.cached && getRes.data.summary) {
          setSummaryData(getRes.data.summary);
          setLoading(false);
          return;
        }
      }

      // If not cached or force regeneration requested, call POST
      const postRes = await client.post(`/summaries/${documentId}`, { force });
      setSummaryData(postRes.data.summary);
    } catch (err) {
      console.error('Failed to load summary:', err);
      setError(err.response?.data?.error || 'Failed to generate summary. Please try again.');
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  };

  const handleCopyMarkdown = () => {
    if (!summaryData) return;

    let text = `# Summary: ${summaryData.filename || filename || 'Document'}\n\n`;
    text += `**Difficulty:** ${summaryData.difficulty} | **Est. Reading Time:** ${summaryData.readingTimeMinutes} mins\n\n`;
    text += `## Executive Summary\n${summaryData.executiveSummary}\n\n`;

    if (summaryData.keyTakeaways?.length > 0) {
      text += `## Key Takeaways\n`;
      summaryData.keyTakeaways.forEach((section) => {
        text += `\n### ${section.topic}\n`;
        section.points?.forEach((pt) => {
          text += `- ${pt}\n`;
        });
      });
      text += `\n`;
    }

    if (summaryData.glossary?.length > 0) {
      text += `## Key Terminology & Glossary\n`;
      summaryData.glossary.forEach((item) => {
        text += `- **${item.term}:** ${item.definition}\n`;
      });
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadMarkdown = () => {
    if (!summaryData) return;
    let text = `# Summary: ${summaryData.filename || filename || 'Document'}\n\n`;
    text += `**Difficulty:** ${summaryData.difficulty} | **Est. Reading Time:** ${summaryData.readingTimeMinutes} mins\n\n`;
    text += `## Executive Summary\n${summaryData.executiveSummary}\n\n`;

    if (summaryData.keyTakeaways?.length > 0) {
      text += `## Key Takeaways\n`;
      summaryData.keyTakeaways.forEach((section) => {
        text += `\n### ${section.topic}\n`;
        section.points?.forEach((pt) => {
          text += `- ${pt}\n`;
        });
      });
      text += `\n`;
    }

    if (summaryData.glossary?.length > 0) {
      text += `## Key Terminology & Glossary\n`;
      summaryData.glossary.forEach((item) => {
        text += `- **${item.term}:** ${item.definition}\n`;
      });
    }

    downloadTextFile(
      `${(summaryData.filename || filename || 'document').replace(/\.[^/.]+$/, '')}-summary.md`,
      text
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 md:p-6 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 bg-gradient-to-r from-slate-50 via-white to-fuchsia-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-sm">
              <Sparkles size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-bold text-slate-900 dark:text-white truncate">
                  AI Document Insights
                </h2>
                {summaryData && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold bg-fuchsia-50 dark:bg-fuchsia-950/80 text-fuchsia-700 dark:text-fuchsia-300 px-2.5 py-0.5 rounded-full border border-fuchsia-200/60 dark:border-fuchsia-800/80">
                    <CheckCircle2 size={11} /> Saved in DB
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-md">
                {summaryData?.filename || filename || 'Document Overview'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {summaryData && (
              <>
                <button
                  onClick={() => exportStudyGuideToPdf(summaryData.filename || filename, summaryData, null)}
                  title="Download complete formatted Study Guide as PDF"
                  className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl shadow-xs transition"
                >
                  <FileDown size={14} />
                  <span className="hidden sm:inline">PDF Guide</span>
                </button>

                <button
                  onClick={handleDownloadMarkdown}
                  title="Download as Markdown file"
                  className="flex items-center gap-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-2.5 py-1.5 rounded-xl transition"
                >
                  <Download size={14} />
                  <span className="hidden sm:inline">.MD</span>
                </button>

                <button
                  onClick={handleCopyMarkdown}
                  title="Copy formatted markdown to clipboard"
                  className="flex items-center gap-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-2.5 py-1.5 rounded-xl transition"
                >
                  {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  onClick={() => loadSummary(true)}
                  disabled={regenerating}
                  title="Force regenerate summary"
                  className="flex items-center gap-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-2.5 py-1.5 rounded-xl transition disabled:opacity-50"
                >
                  <RotateCcw size={14} className={regenerating ? 'animate-spin' : ''} />
                  <span className="hidden sm:inline">Regenerate</span>
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Quick Stats Bar (when summary available) */}
        {summaryData && !loading && (
          <div className="px-6 py-3 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                <Clock size={14} className="text-indigo-500" />
                <span>Reading Time: <strong>~{summaryData.readingTimeMinutes} min</strong></span>
              </span>

              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                <Layers size={14} className="text-fuchsia-500" />
                <span>Complexity: <strong>{summaryData.difficulty}</strong></span>
              </span>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl p-0.5 gap-0.5">
              <button
                onClick={() => setActiveTab('executive')}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  activeTab === 'executive'
                    ? 'bg-fuchsia-500 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Executive TL;DR
              </button>
              <button
                onClick={() => setActiveTab('takeaways')}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  activeTab === 'takeaways'
                    ? 'bg-fuchsia-500 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Key Takeaways ({summaryData.keyTakeaways?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('glossary')}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  activeTab === 'glossary'
                    ? 'bg-fuchsia-500 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Glossary ({summaryData.glossary?.length || 0})
              </button>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Loading View */}
          {loading && (
            <div className="py-20 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-fuchsia-50 dark:bg-fuchsia-950/60 flex items-center justify-center mx-auto text-fuchsia-600 dark:text-fuchsia-400 shadow-inner">
                <Loader2 size={32} className="animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                  Synthesizing Multi-Level AI Summary...
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm max-w-md mx-auto mt-1">
                  Extracting key topics, abstractive executive brief, reading stats, and domain glossary.
                </p>
              </div>
            </div>
          )}

          {/* Error View */}
          {!loading && error && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 rounded-2xl p-6 text-center space-y-3">
              <AlertCircle size={28} className="text-red-500 mx-auto" />
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>
              <button
                onClick={() => loadSummary(true)}
                className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
              >
                <RotateCcw size={14} /> Retry Generation
              </button>
            </div>
          )}

          {/* Content View */}
          {!loading && !error && summaryData && (
            <>
              {/* TAB 1: EXECUTIVE SUMMARY */}
              {activeTab === 'executive' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="bg-gradient-to-br from-indigo-50/50 via-fuchsia-50/40 to-white dark:from-slate-800/60 dark:via-slate-800/30 dark:to-slate-900 border border-indigo-100/80 dark:border-slate-800 rounded-3xl p-6 md:p-8">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-fuchsia-600 dark:text-fuchsia-400 mb-3">
                      <BookOpen size={16} />
                      <span>Executive Overview</span>
                    </div>

                    <p className="text-base md:text-lg text-slate-800 dark:text-slate-200 leading-relaxed font-normal whitespace-pre-line">
                      {summaryData.executiveSummary}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200/70 dark:border-slate-800 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                        <Clock size={16} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wide">
                          Time Saved
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Read in ~{summaryData.readingTimeMinutes} mins instead of skimming raw pages.
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200/70 dark:border-slate-800 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-fuchsia-100 dark:bg-fuchsia-950 text-fuchsia-600 dark:text-fuchsia-400 flex items-center justify-center shrink-0">
                        <Layers size={16} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wide">
                          Cached In PostgreSQL
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Persisted to database for instant zero-latency future retrieval.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: KEY TAKEAWAYS */}
              {activeTab === 'takeaways' && (
                <div className="space-y-4 animate-fade-in">
                  {summaryData.keyTakeaways?.map((section, idx) => (
                    <div
                      key={idx}
                      className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 md:p-6 shadow-xs hover:border-fuchsia-300 dark:hover:border-fuchsia-700 transition"
                    >
                      <div className="flex items-center gap-2.5 mb-3">
                        <span className="w-6 h-6 rounded-lg bg-fuchsia-100 dark:bg-fuchsia-950 text-fuchsia-700 dark:text-fuchsia-300 text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <h4 className="text-base font-bold text-slate-900 dark:text-white">
                          {section.topic}
                        </h4>
                      </div>

                      <ul className="space-y-2.5 pl-2">
                        {section.points?.map((pt, pIdx) => (
                          <li
                            key={pIdx}
                            className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500 shrink-0 mt-2" />
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 3: GLOSSARY */}
              {activeTab === 'glossary' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                  {summaryData.glossary?.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 md:p-5 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <Bookmark size={14} className="text-indigo-500" />
                          <h5 className="font-bold text-slate-900 dark:text-white text-sm">
                            {item.term}
                          </h5>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {item.definition}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
