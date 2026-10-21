import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, NotebookText, Award, HelpCircle, CheckCircle2, XCircle, RotateCcw, ChevronRight, ChevronLeft, Loader2, BookOpen, GraduationCap, History, Trash2, MessageSquare, Sun, Moon, Monitor, Check, Flame, Info, Download, FileDown } from 'lucide-react';
import client from '../api/client';
import { useTheme } from '../context/ThemeContext';
import SummaryModal from '../components/SummaryModal';
import { exportQuizScorecardPdf, exportStudyGuideToPdf } from '../utils/exportUtils';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';
import AudioMessagePlayer from '../components/AudioMessagePlayer';

export default function Quiz() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const { mode, setTheme } = useTheme();
  const voice = useVoiceAssistant();

  // Document details
  const [documentInfo, setDocumentInfo] = useState(null);

  // Mode: 'mcq' | 'viva'
  const [activeTab, setActiveTab] = useState('mcq');

  // Generation options
  const [difficulty, setDifficulty] = useState('medium');
  const [questionCount, setQuestionCount] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  // Active Quiz State
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [userAnswers, setUserAnswers] = useState({});
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState(null);

  // Viva practiced states
  const [expandedViva, setExpandedViva] = useState({});
  const [masteredViva, setMasteredViva] = useState({});

  // History state
  const [quizHistory, setQuizHistory] = useState([]);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  const themeOptions = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'Default' },
  ];

  // Fetch document details and quiz history on mount
  useEffect(() => {
    fetchDocumentDetails();
    fetchHistory();
  }, [documentId]);

  const fetchDocumentDetails = async () => {
    try {
      const res = await client.get('/documents');
      const doc = res.data.find((d) => d.id === documentId);
      if (doc) {
        setDocumentInfo(doc);
      }
    } catch (err) {
      console.error('Failed to load document info:', err);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await client.get(`/quiz/document/${documentId}`);
      setQuizHistory(res.data);
      // If there's an existing quiz in history and no current quiz loaded, load the most recent one
      if (res.data.length > 0 && !currentQuiz) {
        loadExistingQuiz(res.data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch quiz history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadExistingQuiz = async (quizId) => {
    try {
      const res = await client.get(`/quiz/${quizId}`);
      const quiz = res.data;
      setCurrentQuiz(quiz);
      setActiveTab(quiz.quiz_type);
      setActiveQuestionIndex(0);

      if (quiz.quiz_type === 'mcq' && quiz.completed) {
        setQuizResult({
          score: quiz.score,
          totalQuestions: quiz.total_questions,
          percentage: Math.round((quiz.score / quiz.total_questions) * 100),
          userAnswers: quiz.user_answers || [],
          questions: quiz.questions,
        });
      } else {
        setQuizResult(null);
        // Pre-populate answers if partial
        const existingAnswers = {};
        if (Array.isArray(quiz.user_answers)) {
          quiz.user_answers.forEach((ans, i) => {
            if (ans !== null && ans !== undefined) existingAnswers[i] = ans;
          });
        }
        setUserAnswers(existingAnswers);
      }
    } catch (err) {
      console.error('Failed to load quiz:', err);
    }
  };

  const handleGenerate = async (targetType = activeTab) => {
    setGenerating(true);
    setError('');
    try {
      const res = await client.post(`/quiz/generate/${documentId}`, {
        type: targetType,
        count: questionCount,
        difficulty,
      });

      const newQuiz = res.data;
      setCurrentQuiz(newQuiz);
      setUserAnswers({});
      setActiveQuestionIndex(0);
      setQuizResult(null);
      setExpandedViva({});
      setMasteredViva({});

      // Refresh history list
      fetchHistory();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate quiz. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectOption = (questionIndex, optionIndex) => {
    if (quizResult) return; // quiz already completed
    setUserAnswers((prev) => ({
      ...prev,
      [questionIndex]: optionIndex,
    }));
  };

  const handleSubmitQuiz = async () => {
    if (!currentQuiz) return;
    setSubmitting(true);
    try {
      const answersArray = currentQuiz.questions.map((_, i) => userAnswers[i] ?? null);
      const res = await client.post(`/quiz/${currentQuiz.id}/submit`, {
        userAnswers: answersArray,
      });

      setQuizResult(res.data);
      fetchHistory(); // refresh score in history
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit quiz.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetake = () => {
    setUserAnswers({});
    setQuizResult(null);
    setActiveQuestionIndex(0);
  };

  const handleDeleteQuiz = async (quizId, e) => {
    e.stopPropagation();
    try {
      await client.delete(`/quiz/${quizId}`);
      setQuizHistory((prev) => prev.filter((q) => q.id !== quizId));
      if (currentQuiz?.id === quizId) {
        setCurrentQuiz(null);
        setQuizResult(null);
      }
    } catch (err) {
      console.error('Failed to delete quiz:', err);
    }
  };

  const toggleVivaAccordion = (index) => {
    setExpandedViva((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const toggleMastered = (index, e) => {
    e.stopPropagation();
    setMasteredViva((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // The generate endpoint returns quizType and the history endpoint quiz_type
  const currentQuizType = currentQuiz?.quiz_type || currentQuiz?.quizType;
  const questions = currentQuiz?.questions || [];
  const currentQ = questions[activeQuestionIndex];
  const isAllAnswered = questions.length > 0 && questions.every((_, i) => userAnswers[i] !== undefined);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans">
      {/* Top Navbar */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition p-1 rounded-lg"
            title="Back to Dashboard"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 flex items-center justify-center">
              <GraduationCap size={18} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900 dark:text-white text-sm md:text-base">
                  Quiz & Viva Assessment
                </span>
                {documentInfo && (
                  <span className="hidden sm:inline-block max-w-[200px] truncate text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded">
                    {documentInfo.filename}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 hidden sm:block">
                Practice questions written from this document
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Summary Modal Toggle */}
          <button
            onClick={() => setShowSummaryModal(true)}
            className="flex items-center gap-1.5 text-xs font-medium bg-fuchsia-50 hover:bg-fuchsia-100 dark:bg-fuchsia-950 dark:hover:bg-fuchsia-900 text-fuchsia-700 dark:text-fuchsia-300 border border-fuchsia-200/60 dark:border-fuchsia-800/80 px-3 py-1.5 rounded-lg transition"
            title="View AI Document Insights & Summary"
          >
            <NotebookText size={14} />
            <span className="hidden md:inline">Summary</span>
          </button>

          {/* Download Study Guide PDF */}
          <button
            onClick={() => exportStudyGuideToPdf(documentInfo?.filename, null, currentQuiz)}
            disabled={!currentQuiz}
            className="flex items-center gap-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 px-3 py-1.5 rounded-lg transition disabled:opacity-40"
            title="Download Study & Revision Guide PDF"
          >
            <Download size={14} />
            <span className="hidden md:inline">Download PDF</span>
          </button>

          {/* Link to Chat */}
          <button
            onClick={() => navigate(`/chat/${documentId}`)}
            className="flex items-center gap-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg transition"
          >
            <MessageSquare size={14} />
            <span className="hidden md:inline">Open Chat</span>
          </button>

          {/* History drawer toggle */}
          <button
            onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition ${
              showHistoryDrawer
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950 dark:border-indigo-700 dark:text-indigo-300'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-300'
            }`}
          >
            <History size={14} />
            <span>History ({quizHistory.length})</span>
          </button>

          {/* Theme toggle */}
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

      <div className="flex-1 max-w-5xl w-full mx-auto px-4 md:px-6 py-6 flex flex-col gap-6">
        {/* Navigation Tabs (MCQ vs Viva) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-2 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl">
            <button
              onClick={() => {
                setActiveTab('mcq');
                // Showing a viva set in the MCQ view crashes the page, so clear it first
                if (currentQuizType !== 'mcq') {
                  setCurrentQuiz(null);
                  setQuizResult(null);
                  const pastMcq = quizHistory.find((q) => q.quiz_type === 'mcq');
                  if (pastMcq) loadExistingQuiz(pastMcq.id);
                }
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === 'mcq'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <HelpCircle size={16} />
              <span>Interactive MCQ Quiz</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('viva');
                if (currentQuizType !== 'viva') {
                  setCurrentQuiz(null);
                  setQuizResult(null);
                  const pastViva = quizHistory.find((q) => q.quiz_type === 'viva');
                  if (pastViva) loadExistingQuiz(pastViva.id);
                }
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === 'viva'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Flame size={16} className="text-amber-500" />
              <span>Viva & Oral Exam Prep</span>
            </button>
          </div>

          {/* Quick Generator Bar */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Difficulty selection */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-900/50 rounded-lg p-1 text-xs font-medium">
              {['easy', 'medium', 'hard'].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setDifficulty(lvl)}
                  className={`px-2.5 py-1 rounded capitalize transition ${
                    difficulty === lvl
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            {/* Questions count */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-900/50 rounded-lg p-1 text-xs font-medium">
              {[5, 10].map((num) => (
                <button
                  key={num}
                  onClick={() => setQuestionCount(num)}
                  className={`px-2.5 py-1 rounded transition ${
                    questionCount === num
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  {num} Qs
                </button>
              ))}
            </div>

            {/* Generate Action */}
            <button
              onClick={() => handleGenerate(activeTab)}
              disabled={generating}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm hover:shadow transition disabled:opacity-50"
            >
              {generating ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Generating AI Questions...</span>
                </>
              ) : (
                <>
                  <NotebookText size={14} />
                  <span>Generate New Set</span>
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm px-4 py-3 rounded-xl flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 font-bold">
              ×
            </button>
          </div>
        )}

        {/* Loading state */}
        {generating && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-12 text-center shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center mx-auto mb-4 text-indigo-600 dark:text-indigo-400">
              <Loader2 size={28} className="animate-spin" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-1">
              Analyzing Document & Crafting {activeTab === 'mcq' ? 'MCQ Quiz' : 'Viva Questions'}...
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto">
              Reading semantic chunks, mapping page citations, and generating high-yield {difficulty}-level questions.
            </p>
          </div>
        )}

        {/* Empty state when no quiz loaded and not generating */}
        {!generating && (!currentQuiz || currentQuizType !== activeTab) && (
          <div className="bg-white dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center mx-auto mb-4 text-indigo-600 dark:text-indigo-400">
              <BookOpen size={28} />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
              Ready to test your knowledge on this document?
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-lg mx-auto mb-6">
              Choose your difficulty and question count above, then click <strong>"Generate New Set"</strong> to build an interactive MCQ exam or an oral viva defense guide.
            </p>
            <button
              onClick={() => handleGenerate(activeTab)}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-5 py-2.5 rounded-xl shadow transition"
            >
              <NotebookText size={16} />
              <span>Generate {activeTab === 'mcq' ? 'MCQ Quiz' : 'Viva Prep Set'} Now</span>
            </button>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            MODE A: INTERACTIVE MCQ QUIZ
           ───────────────────────────────────────────────────────────── */}
        {!generating && currentQuiz && activeTab === 'mcq' && currentQuizType === 'mcq' && (
          <div className="space-y-6">
            {/* If Quiz is COMPLETED: Show Score Banner and Full Review */}
            {quizResult ? (
              <div className="space-y-6">
                {/* Score Banner */}
                <div className="bg-indigo-600 text-white rounded-2xl p-6 md:p-8 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Award size={24} className="text-amber-300" />
                      <span className="text-xs font-semibold text-indigo-100">
                        Quiz Completed
                      </span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-extrabold mb-1">
                      You Scored {quizResult.score} / {quizResult.totalQuestions} ({quizResult.percentage}%)
                    </h2>
                    <p className="text-indigo-100 text-sm">
                      {quizResult.percentage >= 80
                        ? '🎉 Outstanding mastery! You understand this document thoroughly.'
                        : quizResult.percentage >= 60
                        ? '👍 Solid effort! Review the explanations below to strengthen weak spots.'
                        : '📚 Needs revision. Read through the citations and retake to master the concepts.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                    <button
                      onClick={() => exportQuizScorecardPdf(documentInfo?.filename, currentQuiz, quizResult)}
                      className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-3.5 py-2.5 rounded-xl font-medium text-xs md:text-sm transition shadow-xs"
                      title="Download Scorecard Report as PDF"
                    >
                      <FileDown size={16} />
                      <span>Scorecard PDF</span>
                    </button>
                    <button
                      onClick={handleRetake}
                      className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-3.5 py-2.5 rounded-xl font-medium text-xs md:text-sm transition"
                    >
                      <RotateCcw size={15} />
                      <span>Retake</span>
                    </button>
                    <button
                      onClick={() => handleGenerate('mcq')}
                      className="flex items-center gap-1.5 bg-white text-indigo-700 hover:bg-indigo-50 px-3.5 py-2.5 rounded-xl font-semibold text-xs md:text-sm shadow transition"
                    >
                      <NotebookText size={15} />
                      <span>New Set</span>
                    </button>
                  </div>
                </div>

                {/* Review Breakdown */}
                <div className="space-y-4">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-indigo-600 dark:text-indigo-400" />
                    <span>Detailed Answer & Citation Review</span>
                  </h3>

                  {questions.map((q, idx) => {
                    const chosen = quizResult.userAnswers?.[idx];
                    const isCorrect = Number(chosen) === Number(q.correctAnswer);

                    return (
                      <div
                        key={idx}
                        className={`bg-white dark:bg-slate-800 rounded-2xl p-5 md:p-6 border transition ${
                          isCorrect
                            ? 'border-emerald-200 dark:border-emerald-900/50'
                            : 'border-red-200 dark:border-red-900/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                                isCorrect ? 'bg-emerald-500' : 'bg-red-500'
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <span className="text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">
                              Question {idx + 1} of {questions.length}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {q.pageNumber && (
                              <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded font-medium">
                                Cited on Page {q.pageNumber}
                              </span>
                            )}
                            <span
                              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                                isCorrect
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                              }`}
                            >
                              {isCorrect ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                              {isCorrect ? 'Correct' : 'Incorrect'}
                            </span>
                          </div>
                        </div>

                        <p className="text-base font-semibold text-slate-900 dark:text-white mb-4">
                          {q.question}
                        </p>

                        {/* Options display with correct/incorrect highlighting */}
                        <div className="grid grid-cols-1 gap-2.5 mb-4">
                          {(q.options || []).map((opt, optIdx) => {
                            const isChosenOpt = Number(chosen) === optIdx;
                            const isCorrectOpt = Number(q.correctAnswer) === optIdx;

                            let optStyle =
                              'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300';
                            if (isCorrectOpt) {
                              optStyle =
                                'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-medium';
                            } else if (isChosenOpt && !isCorrect) {
                              optStyle =
                                'border-red-400 bg-red-50/80 dark:bg-red-950/60 text-red-900 dark:text-red-200 line-through';
                            }

                            return (
                              <div
                                key={optIdx}
                                className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm ${optStyle}`}
                              >
                                <div className="flex items-center gap-3">
                                  <span className="w-6 h-6 rounded-lg bg-white dark:bg-slate-800 border border-current text-xs font-bold flex items-center justify-center shrink-0">
                                    {String.fromCharCode(65 + optIdx)}
                                  </span>
                                  <span>{opt}</span>
                                </div>
                                {isCorrectOpt && (
                                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <Check size={14} /> Correct Answer
                                  </span>
                                )}
                                {isChosenOpt && !isCorrect && (
                                  <span className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1">
                                    <XCircle size={14} /> Your Choice
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Explanation box */}
                        {q.explanation && (
                          <div className="bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 rounded-xl p-3.5 text-xs text-indigo-950 dark:text-indigo-200 flex items-start gap-2.5">
                            <Info size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                            <div>
                              <strong className="font-semibold block mb-0.5 text-indigo-900 dark:text-indigo-300">
                                Context Explanation:
                              </strong>
                              <span>{q.explanation}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* ACTIVE QUIZ TAKING VIEW */
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
                {/* Header & Progress Indicator */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-2.5 py-1 rounded-md">
                      {currentQuiz.difficulty} Difficulty
                    </span>
                    <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                      Question {activeQuestionIndex + 1} of {questions.length}
                    </span>
                  </div>

                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    Answered: {Object.keys(userAnswers).length} / {questions.length}
                  </span>
                </div>

                {/* Question Progress Bar */}
                <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${((activeQuestionIndex + 1) / questions.length) * 100}%`,
                    }}
                  />
                </div>

                {/* Current Question */}
                {currentQ && (
                  <div className="space-y-4 py-2">
                    <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white leading-relaxed">
                      {currentQ?.question}
                    </h2>

                    {/* Options list */}
                    <div className="grid grid-cols-1 gap-3 pt-2">
                      {(currentQ?.options || []).map((option, optIdx) => {
                        const isSelected = userAnswers[activeQuestionIndex] === optIdx;

                        return (
                          <button
                            key={optIdx}
                            onClick={() => handleSelectOption(activeQuestionIndex, optIdx)}
                            className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 shadow-sm ring-1 ring-indigo-500'
                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800/80 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-3.5">
                              <span
                                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm transition ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                              <span className="text-sm md:text-base font-normal">{option}</span>
                            </div>

                            <div
                              className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                                isSelected
                                  ? 'border-indigo-600 bg-indigo-600 text-white'
                                  : 'border-slate-300 dark:border-slate-600'
                              }`}
                            >
                              {isSelected && <Check size={12} />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Question Navigation Palette */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {questions.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveQuestionIndex(i)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition ${
                          activeQuestionIndex === i
                            ? 'ring-2 ring-indigo-500 bg-indigo-600 text-white'
                            : userAnswers[i] !== undefined
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setActiveQuestionIndex((prev) => Math.max(prev - 1, 0))}
                      disabled={activeQuestionIndex === 0}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition"
                    >
                      <ChevronLeft size={16} />
                      <span>Prev</span>
                    </button>

                    {activeQuestionIndex < questions.length - 1 ? (
                      <button
                        onClick={() => setActiveQuestionIndex((prev) => Math.min(prev + 1, questions.length - 1))}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm"
                      >
                        <span>Next</span>
                        <ChevronRight size={16} />
                      </button>
                    ) : (
                      <button
                        onClick={handleSubmitQuiz}
                        disabled={submitting || !isAllAnswered}
                        className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm disabled:opacity-50"
                      >
                        {submitting ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            <span>Submitting...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={14} />
                            <span>Submit Quiz</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            MODE B: VIVA VOCE & ORAL DEFENSE PREPARATION
           ───────────────────────────────────────────────────────────── */}
        {!generating && currentQuiz && activeTab === 'viva' && currentQuizType === 'viva' && (
          <div className="space-y-4">
            {/* Viva Header Info Card */}
            <div className="bg-amber-700 text-white rounded-2xl p-6 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Flame size={20} className="text-amber-200" />
                  <span className="text-xs font-bold text-amber-100">
                    Oral Examination Simulator
                  </span>
                </div>
                <h2 className="text-xl md:text-2xl font-bold">
                  University Viva & Interview Questions
                </h2>
                <p className="text-xs md:text-sm text-amber-100 mt-1 max-w-xl">
                  Test your oral explanation readiness. Read the examiner question, formulate your spoken answer, then expand to compare with the model answer and keywords.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl text-xs font-semibold">
                <span>Practiced: {Object.values(masteredViva).filter(Boolean).length} / {questions.length}</span>
              </div>
            </div>

            {/* Viva Questions Accordion Cards */}
            <div className="space-y-3">
              {questions.map((item, idx) => {
                const isOpen = !!expandedViva[idx];
                const isMastered = !!masteredViva[idx];

                return (
                  <div
                    key={idx}
                    className={`bg-white dark:bg-slate-800 rounded-2xl border transition-all ${
                      isMastered
                        ? 'border-emerald-300 dark:border-emerald-900 bg-emerald-50/20 dark:bg-emerald-950/10'
                        : isOpen
                        ? 'border-indigo-300 dark:border-indigo-600 shadow-sm'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {/* Card Header (Examiner question) */}
                    <div
                      onClick={() => toggleVivaAccordion(idx)}
                      className="p-5 cursor-pointer flex items-start justify-between gap-4 select-none"
                    >
                      <div className="flex items-start gap-3.5">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition ${
                            isMastered
                              ? 'bg-emerald-500 text-white'
                              : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400'
                          }`}
                        >
                          Q{idx + 1}
                        </span>

                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                              Examiner Prompt
                            </span>
                            {item.pageNumber && (
                              <span className="text-[11px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded font-medium">
                                Page {item.pageNumber}
                              </span>
                            )}
                          </div>
                          <h4 className="text-base font-semibold text-slate-900 dark:text-white leading-snug">
                            {item.question}
                          </h4>

                          {/* Voice Readout for Question */}
                          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                            <AudioMessagePlayer
                              messageId={`viva-q-${idx}`}
                              content={item.question}
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
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={(e) => toggleMastered(idx, e)}
                          title={isMastered ? 'Mark as Not Yet Mastered' : 'Mark as Oral Practiced'}
                          className={`p-1.5 rounded-lg border text-xs transition flex items-center gap-1 ${
                            isMastered
                              ? 'bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-700 dark:text-emerald-300'
                              : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 hover:text-emerald-600'
                          }`}
                        >
                          <Check size={14} />
                          <span className="hidden sm:inline">{isMastered ? 'Practiced' : 'Mark Done'}</span>
                        </button>

                        <button className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1">
                          <ChevronRight
                            size={18}
                            className={`transform transition-transform ${isOpen ? 'rotate-90' : ''}`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Card Expanded Content: Model Answer & Key Points */}
                    {isOpen && (
                      <div className="px-5 pb-5 pt-1 border-t border-slate-100 dark:border-slate-700/60 space-y-4">
                        {/* Model Spoken Answer */}
                        <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                              <BookOpen size={14} />
                              <span>Recommended Oral Answer (What to speak):</span>
                            </div>
                            <AudioMessagePlayer
                              messageId={`viva-ans-${idx}`}
                              content={item.modelAnswer}
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
                          <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed italic">
                            "{item.modelAnswer}"
                          </p>
                        </div>

                        {/* Critical keywords / technical points */}
                        {item.keyPoints && item.keyPoints.length > 0 && (
                          <div>
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-2">
                              Critical Keywords to Speak Aloud:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {(item.keyPoints || []).map((kp, kIdx) => (
                                <span
                                  key={kIdx}
                                  className="text-xs bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1 rounded-lg font-medium flex items-center gap-1"
                                >
                                  <Check size={12} className="text-indigo-500" />
                                  {kp}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* History Drawer Modal / Sidebar */}
      {showHistoryDrawer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 h-full p-6 shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700 mb-4">
              <div className="flex items-center gap-2">
                <History size={18} className="text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-slate-900 dark:text-white">Past Assessments</h3>
              </div>
              <button
                onClick={() => setShowHistoryDrawer(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {quizHistory.length === 0 ? (
                <p className="text-center text-slate-400 dark:text-slate-500 py-12 text-sm">
                  No previous quizzes recorded for this document.
                </p>
              ) : (
                quizHistory.map((q) => {
                  const isCurrent = currentQuiz?.id === q.id;
                  const isMcq = q.quiz_type === 'mcq';

                  return (
                    <div
                      key={q.id}
                      onClick={() => {
                        loadExistingQuiz(q.id);
                        setShowHistoryDrawer(false);
                      }}
                      className={`p-3.5 rounded-xl border cursor-pointer transition ${
                        isCurrent
                          ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40'
                          : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            isMcq
                              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {q.quiz_type.toUpperCase()} · {q.difficulty}
                        </span>

                        <button
                          onClick={(e) => handleDeleteQuiz(q.id, e)}
                          className="text-slate-400 hover:text-red-500 p-1"
                          title="Delete assessment"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">
                        {q.title}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 mt-2">
                        <span>
                          {isMcq
                            ? q.completed
                              ? `Score: ${q.score}/${q.total_questions} (${Math.round(
                                  (q.score / q.total_questions) * 100
                                )}%)`
                              : `${q.total_questions} Questions (Pending)`
                            : `${q.total_questions} Viva Questions`}
                        </span>
                        <span>{new Date(q.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary Modal */}
      {showSummaryModal && (
        <SummaryModal
          documentId={documentId}
          filename={documentInfo?.filename}
          onClose={() => setShowSummaryModal(false)}
        />
      )}
    </div>
  );
}
