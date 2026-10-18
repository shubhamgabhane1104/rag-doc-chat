import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, TrendingUp, Layers, MessageSquare, Zap, GraduationCap, Database, Cpu, Activity, Download, RefreshCw, FileText, Clock, ShieldCheck, PieChart, NotebookText, ExternalLink, Server } from 'lucide-react';
import client from '../api/client';
import { exportAnalyticsReportPdf } from '../utils/exportUtils';

export default function Analytics() {
  const navigate = useNavigate();
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [hoveredBar, setHoveredBar] = useState(null);

  const fetchAnalytics = async (selectedDays = days, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const res = await client.get(`/analytics/all?days=${selectedDays}`);
      setData(res.data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setError('Failed to load analytics metrics. Please ensure backend is running.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(days);
  }, [days]);

  const handleExportPdf = () => {
    if (!data) return;
    setExporting(true);
    try {
      exportAnalyticsReportPdf(data);
    } catch (err) {
      console.error('Failed to export PDF:', err);
    } finally {
      setExporting(false);
    }
  };

  const overview = data?.overview;
  const trends = data?.trends || [];
  const docAnalytics = data?.documentAnalytics;
  const health = data?.health;

  // Calculate maximum value for chart scaling
  const maxQueryValue = Math.max(...trends.map((t) => t.queries), 4);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Top Header */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Return to Dashboard"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  Usage
                </h1>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                What you've uploaded, asked and practised, and how the backend is doing
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Days Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium">
              {[7, 14, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    days === d
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 font-semibold shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {d}D
                </button>
              ))}
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => fetchAnalytics(days, true)}
              disabled={refreshing || loading}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition"
              title="Refresh Analytics"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin text-indigo-600' : ''} />
            </button>

            {/* PDF Audit Report Download */}
            <button
              onClick={handleExportPdf}
              disabled={exporting || loading || !data}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/30 transition disabled:opacity-50"
            >
              <Download size={14} />
              <span>{exporting ? 'Generating...' : 'Export Audit PDF'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {loading && !data ? (
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center mb-4">
              <RefreshCw size={24} className="text-indigo-600 animate-spin" />
            </div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">
              Aggregating RAG telemetry & metrics...
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Calculating token savings, vector store index size, and query logs
            </p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300">
            <p className="font-semibold">{error}</p>
            <button
              onClick={() => fetchAnalytics(days)}
              className="mt-3 px-4 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* 1. Top Executive KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total Queries */}
              <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Total RAG Queries
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <MessageSquare size={18} />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                    {overview?.activity?.totalQueries || 0}
                  </span>
                  <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    Queries answered
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Single-Doc: {overview?.activity?.singleDocQueries || 0}</span>
                  <span>Workspace: {overview?.activity?.workspaceQueries || 0}</span>
                </div>
              </div>

              {/* Card 2: Knowledge Base Scale */}
              <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Knowledge Base Scale
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Layers size={18} />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                    {overview?.documents?.total || 0}
                  </span>
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                    Documents ({overview?.documents?.ready || 0} Ready)
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Pages: {overview?.documents?.pages || 0}</span>
                  <span>Chunks: {overview?.documents?.chunks || 0}</span>
                </div>
              </div>

              {/* Card 3: RAG Token Efficiency */}
              <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Token Economics
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Zap size={18} />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                    {overview?.ragEconomics?.tokenSavingsPercent ?? 0}%
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    Context Saved
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Used: {(overview?.ragEconomics?.estimatedTokensUsed || 0).toLocaleString()}</span>
                  <span>Raw: {(overview?.ragEconomics?.estimatedTokensWithoutRag || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Card 4: Quiz & Assessment Metric */}
              <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Quiz & Viva Voce
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <GraduationCap size={18} />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                    {overview?.quizPerformance?.averageScorePercent || 0}%
                  </span>
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                    Avg Score
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Generated: {overview?.quizPerformance?.total || 0}</span>
                  <span>Completed: {overview?.quizPerformance?.completed || 0}</span>
                </div>
              </div>
            </div>

            {/* 2. Visual Activity Chart & Format Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 7/14/30-Day Query Traffic Volume (2 Columns) */}
              <div className="lg:col-span-2 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <BarChart3 size={18} className="text-indigo-600 dark:text-indigo-400" />
                      Daily Query Traffic & Upload Activity
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Interaction volume over the past {days} days
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                      Queries
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-fuchsia-500"></span>
                      Uploads
                    </span>
                  </div>
                </div>

                {/* SVG Visual Bar Chart */}
                <div className="h-56 w-full flex items-end gap-2 pt-6 pb-2 px-2 border-b border-slate-200 dark:border-slate-800">
                  {trends.map((item, index) => {
                    const queryHeight = Math.max((item.queries / maxQueryValue) * 160, 6);
                    const uploadHeight = Math.max((item.uploads / maxQueryValue) * 160, 4);
                    const isHovered = hoveredBar === index;

                    return (
                      <div
                        key={item.date}
                        className="flex-1 flex flex-col items-center justify-end h-full relative group cursor-pointer"
                        onMouseEnter={() => setHoveredBar(index)}
                        onMouseLeave={() => setHoveredBar(null)}
                      >
                        {/* Tooltip on hover */}
                        {isHovered && (
                          <div className="absolute -top-14 z-20 bg-slate-900 text-white text-xs py-1.5 px-2.5 rounded-lg shadow-lg whitespace-nowrap pointer-events-none">
                            <div className="font-bold text-[11px]">{item.label}</div>
                            <div className="text-indigo-300">Queries: {item.queries}</div>
                            <div className="text-fuchsia-300">Uploads: {item.uploads}</div>
                          </div>
                        )}

                        {/* Double Bar Column */}
                        <div className="w-full flex items-end justify-center gap-1">
                          {/* Query Bar */}
                          <div
                            style={{ height: `${queryHeight}px` }}
                            className={`w-3 sm:w-4 rounded-t-md transition-all duration-300 ${
                              item.queries > 0
                                ? 'bg-indigo-600 group-hover:bg-indigo-500'
                                : 'bg-slate-200 dark:bg-slate-800'
                            }`}
                          />
                          {/* Upload Bar */}
                          <div
                            style={{ height: `${uploadHeight}px` }}
                            className={`w-2 sm:w-3 rounded-t-md transition-all duration-300 ${
                              item.uploads > 0
                                ? 'bg-fuchsia-600 group-hover:bg-fuchsia-500'
                                : 'bg-slate-200/50 dark:bg-slate-800/50'
                            }`}
                          />
                        </div>

                        {/* X-Axis Date Label */}
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 truncate max-w-[45px]">
                          {item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Activity size={13} className="text-emerald-500" />
                    Peak day: {trends.reduce((prev, curr) => (curr.queries > prev.queries ? curr : prev), trends[0] || {}).label || 'N/A'}
                  </span>
                  <span>Average model latency: {overview?.ragEconomics?.avgLatencyMs != null ? `${overview.ragEconomics.avgLatencyMs} ms` : 'no requests yet'}</span>
                </div>
              </div>

              {/* Document Format & Quiz Distribution (1 Column) */}
              <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                    <PieChart size={18} className="text-fuchsia-600 dark:text-fuchsia-400" />
                    Format & Assessment Distribution
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
                    Storage breakdown by document file extension
                  </p>

                  {/* Format Bars */}
                  <div className="space-y-3.5">
                    {Object.entries(docAnalytics?.formatDistribution || {}).map(([format, count]) => {
                      const totalDocs = overview?.documents?.total || 1;
                      const percentage = Math.round((count / Math.max(totalDocs, 1)) * 100);
                      return (
                        <div key={format}>
                          <div className="flex items-center justify-between text-xs font-semibold mb-1">
                            <span className="text-slate-700 dark:text-slate-300">{format} Files</span>
                            <span className="text-slate-500 dark:text-slate-400">
                              {count} ({percentage}%)
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${percentage}%` }}
                              className={`h-full rounded-full transition-all duration-500 ${
                                format === 'PDF'
                                  ? 'bg-indigo-600'
                                  : format === 'TXT'
                                  ? 'bg-blue-500'
                                  : format === 'DOCX'
                                  ? 'bg-fuchsia-500'
                                  : 'bg-emerald-500'
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Score Rating Badges */}
                <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                    Viva Assessment Readiness
                  </span>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-xl border border-emerald-200/50 dark:border-emerald-800/40">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">
                        {docAnalytics?.quizScoreDistribution?.highScore || 0}
                      </span>
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-300">Mastery (≥80%)</span>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-950/40 p-2 rounded-xl border border-amber-200/50 dark:border-amber-800/40">
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400 block">
                        {docAnalytics?.quizScoreDistribution?.averageScore || 0}
                      </span>
                      <span className="text-[10px] text-amber-700 dark:text-amber-300">Good (50-79%)</span>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                        {docAnalytics?.quizScoreDistribution?.needsReview || 0}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">Review (&lt;50%)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Lower Grid: Leaderboard & System Health */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Document Query Leaderboard (2 Columns) */}
              <div className="lg:col-span-2 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <TrendingUp size={18} className="text-indigo-600 dark:text-indigo-400" />
                      Document Utilization Leaderboard
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Most frequently queried documents and verified citations
                    </p>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Showing top {docAnalytics?.leaderboard?.length || 0} files
                  </span>
                </div>

                {docAnalytics?.leaderboard?.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    No documents queried yet. Start asking questions in Document Chat!
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                          <th className="pb-3 font-semibold">Rank</th>
                          <th className="pb-3 font-semibold">Document Name</th>
                          <th className="pb-3 font-semibold">Pages / Chunks</th>
                          <th className="pb-3 font-semibold">Queries</th>
                          <th className="pb-3 font-semibold">Citations</th>
                          <th className="pb-3 font-semibold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {docAnalytics?.leaderboard?.map((doc, idx) => (
                          <tr key={doc.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                            <td className="py-3 font-bold text-slate-500">
                              {idx === 0 ? (
                                <span className="inline-block px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 text-[10px]">
                                  🥇 1st
                                </span>
                              ) : idx === 1 ? (
                                <span className="inline-block px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px]">
                                  🥈 2nd
                                </span>
                              ) : idx === 2 ? (
                                <span className="inline-block px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400 text-[10px]">
                                  🥉 3rd
                                </span>
                              ) : (
                                `#${idx + 1}`
                              )}
                            </td>
                            <td className="py-3 font-medium text-slate-900 dark:text-white max-w-[180px] sm:max-w-xs truncate">
                              <div className="flex items-center gap-2">
                                <FileText size={14} className="text-indigo-600 shrink-0" />
                                <span className="truncate">{doc.filename}</span>
                              </div>
                            </td>
                            <td className="py-3 text-slate-500 dark:text-slate-400">
                              {doc.pageCount} pgs · {doc.chunkCount} chunks
                            </td>
                            <td className="py-3 font-semibold text-indigo-600 dark:text-indigo-400">
                              {doc.queryCount}
                            </td>
                            <td className="py-3 text-slate-600 dark:text-slate-300">
                              {doc.citationCount}
                            </td>
                            <td className="py-3 text-right">
                              <button
                                onClick={() => navigate(`/chat/${doc.id}`)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                              >
                                Chat
                                <ExternalLink size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Infrastructure & System Health (1 Column) */}
              <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <ShieldCheck size={18} className="text-emerald-600 dark:text-emerald-400" />
                      Infrastructure Health
                    </h3>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  </div>

                  <div className="space-y-4">
                    {/* Database Health */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Database size={16} className="text-blue-600 dark:text-blue-400" />
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            PostgreSQL DB
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          {health?.database?.status || 'Connected'}
                        </span>
                      </div>
                      <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                        <span>Database Size:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {health?.database?.size || 'N/A'}
                        </span>
                      </div>
                    </div>

                    {/* Vector Store Cache */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Server size={16} className="text-indigo-600 dark:text-indigo-400" />
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            Vectors (pgvector)
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          {health?.vectorStore?.status || 'Operational'}
                        </span>
                      </div>
                      <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                        <div className="flex justify-between">
                          <span>Indexed Vectors:</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {health?.vectorStore?.totalVectors || 0} chunks ({health?.vectorStore?.dimension || 3072} dims)
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Disk Footprint:</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {health?.vectorStore?.storagePretty || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* LLM Model Cluster */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <NotebookText size={16} className="text-fuchsia-600 dark:text-fuchsia-400" />
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            Gemini AI Cluster
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          {health?.llmCluster?.status || 'Active'}
                        </span>
                      </div>
                      <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                        <div className="flex justify-between">
                          <span>Primary Tier:</span>
                          <span className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 font-bold truncate max-w-[130px]">
                            {health?.llmCluster?.primaryModel || 'gemini-3-flash-preview'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Failover Resilience:</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {health?.llmCluster?.fallbackTiersAvailable || 5} fallback tiers
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Runtime stats */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Cpu size={16} className="text-slate-600 dark:text-slate-400" />
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            Node.js Runtime
                          </span>
                        </div>
                        <span className="text-[11px] font-mono font-medium text-slate-600 dark:text-slate-400">
                          {health?.runtime?.nodeVersion || 'v24'}
                        </span>
                      </div>
                      <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                        <span>Heap Memory:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {health?.runtime?.heapUsedMB} / {health?.runtime?.heapTotalMB}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    Server Uptime: {health?.runtime?.uptime || 'N/A'}
                  </span>
                  <span>SSL / HTTPS Ready</span>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
