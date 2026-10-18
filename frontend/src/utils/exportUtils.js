import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Color Palette Constants
const COLORS = {
  primary: [79, 70, 229], // Indigo 600
  primaryLight: [238, 242, 255], // Indigo 50
  secondary: [217, 70, 239], // Fuchsia 500
  textDark: [30, 41, 59], // Slate 800
  textMuted: [100, 116, 139], // Slate 500
  border: [226, 232, 240], // Slate 200
  bgCard: [248, 250, 252], // Slate 50
  emerald: [16, 185, 129], // Emerald 500
  red: [239, 68, 68], // Red 500
};

/**
 * Adds running header and footer with page numbers
 */
function addPageDecorations(doc, docTitle, totalPages) {
  const pageCount = totalPages || doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Running Header
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textMuted);
    doc.text(`RAG-Doc-Chat Academic Report · ${docTitle || 'Document'}`, 15, 10);
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.2);
    doc.line(15, 12, pageWidth - 15, 12);

    // Running Footer
    doc.line(15, pageHeight - 12, pageWidth - 15, pageHeight - 12);
    doc.text(
      `Generated on ${new Date().toLocaleDateString()} · Page ${i} of ${pageCount}`,
      pageWidth - 15,
      pageHeight - 8,
      { align: 'right' }
    );
    doc.text('Confidential · For Academic & Study Purposes Only', 15, pageHeight - 8);
  }
}

/**
 * Trigger browser file download for Markdown or text
 */
export function downloadTextFile(filename, content, mimeType = 'text/markdown') {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. EXPORT CHAT CONVERSATION TO PDF
// ─────────────────────────────────────────────────────────────────────────────
export function exportChatToPdf(filename, messages) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const contentWidth = pageWidth - 30; // 15mm margins on each side
  let y = 22;

  // Header Banner
  doc.setFillColor(...COLORS.primary);
  doc.roundedRect(15, y, contentWidth, 24, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('RAG-Doc-Chat · Q&A Transcript', 20, y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(224, 231, 255);
  doc.text(`Document: ${filename || 'Document'}`, 20, y + 16);
  doc.text(`Total Q&A Exchanges: ${messages.length}`, pageWidth - 20, y + 16, { align: 'right' });

  y += 32;

  if (!messages || messages.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.textMuted);
    doc.text('No conversation messages recorded yet.', 15, y);
    addPageDecorations(doc, filename);
    doc.save(`${(filename || 'chat').replace(/\.[^/.]+$/, '')}-chat-transcript.pdf`);
    return;
  }

  messages.forEach((msg, idx) => {
    const isUser = msg.role === 'user';

    // Page overflow check
    if (y > pageHeight - 35) {
      doc.addPage();
      y = 20;
    }

    // Role Indicator Badge
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);

    if (isUser) {
      doc.setFillColor(...COLORS.primaryLight);
      doc.roundedRect(15, y, 22, 6, 1.5, 1.5, 'F');
      doc.setTextColor(...COLORS.primary);
      doc.text('USER', 18, y + 4.2);
    } else {
      doc.setFillColor(243, 232, 255); // Fuchsia light
      doc.roundedRect(15, y, 28, 6, 1.5, 1.5, 'F');
      doc.setTextColor(147, 51, 234);
      doc.text('ASSISTANT', 18, y + 4.2);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textMuted);
    if (msg.created_at) {
      doc.text(new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 48, y + 4.2);
    }

    y += 9;

    // Message Content
    doc.setFont('helvetica', isUser ? 'bold' : 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORS.textDark);

    const splitText = doc.splitTextToSize(msg.content, contentWidth - 4);
    for (let line of splitText) {
      if (y > pageHeight - 25) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, 17, y);
      y += 4.8;
    }

    // Sources Citations Block for Assistant
    if (!isUser && msg.sources && msg.sources.length > 0) {
      y += 2;
      if (y > pageHeight - 30) {
        doc.addPage();
        y = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.textMuted);
      doc.text('Source Citations:', 17, y);
      y += 4;

      msg.sources.forEach((s) => {
        const citationHeader = `[Page ${s.pageNumber || '?'}]`;
        const citationBody = ` — "${(s.snippet || '').replace(/\s+/g, ' ').slice(0, 160)}..."`;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.primary);

        if (y > pageHeight - 20) {
          doc.addPage();
          y = 20;
        }

        doc.text(citationHeader, 20, y);
        const headerWidth = doc.getTextWidth(citationHeader);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.textMuted);
        const snippetLines = doc.splitTextToSize(citationBody, contentWidth - headerWidth - 10);
        doc.text(snippetLines, 20 + headerWidth, y);
        y += snippetLines.length * 3.8 + 1.5;
      });
    }

    y += 6;
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.15);
    doc.line(15, y - 2, pageWidth - 15, y - 2);
    y += 4;
  });

  addPageDecorations(doc, filename);
  doc.save(`${(filename || 'chat').replace(/\.[^/.]+$/, '')}-chat-transcript.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. EXPORT CHAT CONVERSATION TO MARKDOWN
// ─────────────────────────────────────────────────────────────────────────────
export function exportChatToMarkdown(filename, messages) {
  let md = `# Q&A Transcript: ${filename || 'Document'}\n`;
  md += `*Exported on: ${new Date().toLocaleString()}*\n\n---\n\n`;

  if (!messages || messages.length === 0) {
    md += `*No conversation recorded.*\n`;
  } else {
    messages.forEach((msg, idx) => {
      const isUser = msg.role === 'user';
      if (isUser) {
        md += `### 👤 Question ${Math.floor(idx / 2) + 1}\n${msg.content}\n\n`;
      } else {
        md += `### 🤖 Assistant Answer\n${msg.content}\n\n`;
        if (msg.sources && msg.sources.length > 0) {
          md += `**Sources Cited:**\n`;
          msg.sources.forEach((s) => {
            md += `- **Page ${s.pageNumber}:** *"${s.snippet}..."*\n`;
          });
          md += `\n`;
        }
        md += `---\n\n`;
      }
    });
  }

  downloadTextFile(`${(filename || 'chat').replace(/\.[^/.]+$/, '')}-chat.md`, md);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. EXPORT COMPREHENSIVE STUDY BOOKLET TO PDF
// ─────────────────────────────────────────────────────────────────────────────
export function exportStudyGuideToPdf(filename, summaryData, quizData) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const contentWidth = pageWidth - 30;
  let y = 20;

  // Title Cover Banner
  doc.setFillColor(...COLORS.primary);
  doc.roundedRect(15, y, contentWidth, 28, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('Comprehensive Study & Revision Guide', 20, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(224, 231, 255);
  doc.text(`Document: ${filename || 'Document'}`, 20, y + 18);
  doc.text(
    `Est. Read: ~${summaryData?.readingTimeMinutes || 5} min  |  Difficulty: ${summaryData?.difficulty || 'Intermediate'}`,
    20,
    y + 23
  );

  y += 36;

  // Section 1: Executive Summary
  if (summaryData?.executiveSummary) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.primary);
    doc.text('1. Executive Overview (TL;DR)', 15, y);
    y += 5;

    doc.setFillColor(...COLORS.bgCard);
    doc.setDrawColor(...COLORS.border);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORS.textDark);
    const splitExec = doc.splitTextToSize(summaryData.executiveSummary, contentWidth - 8);
    const boxHeight = splitExec.length * 4.8 + 6;

    if (y + boxHeight > pageHeight - 25) {
      doc.addPage();
      y = 20;
    }

    doc.roundedRect(15, y, contentWidth, boxHeight, 2, 2, 'FD');
    doc.text(splitExec, 19, y + 6);
    y += boxHeight + 8;
  }

  // Section 2: Key Takeaways
  if (summaryData?.keyTakeaways && summaryData.keyTakeaways.length > 0) {
    if (y > pageHeight - 40) {
      doc.addPage();
      y = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.primary);
    doc.text('2. Thematic Key Takeaways', 15, y);
    y += 6;

    summaryData.keyTakeaways.forEach((sec, sIdx) => {
      if (y > pageHeight - 30) {
        doc.addPage();
        y = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.textDark);
      doc.text(`${sIdx + 1}. ${sec.topic}`, 18, y);
      y += 4.5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);

      sec.points?.forEach((pt) => {
        const bulletLines = doc.splitTextToSize(`• ${pt}`, contentWidth - 8);
        if (y + bulletLines.length * 4 > pageHeight - 25) {
          doc.addPage();
          y = 20;
        }
        doc.text(bulletLines, 22, y);
        y += bulletLines.length * 4.2;
      });
      y += 3;
    });
    y += 4;
  }

  // Section 3: Glossary Table
  if (summaryData?.glossary && summaryData.glossary.length > 0) {
    if (y > pageHeight - 45) {
      doc.addPage();
      y = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.primary);
    doc.text('3. Key Terminology & Definitions', 15, y);
    y += 4;

    const tableData = summaryData.glossary.map((g) => [g.term, g.definition]);

    autoTable(doc, {
      startY: y,
      margin: { left: 15, right: 15 },
      head: [['Term / Acronym', 'Context Definition']],
      body: tableData,
      headStyles: {
        fillColor: COLORS.primary,
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9,
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 3,
        textColor: COLORS.textDark,
      },
      columnStyles: {
        0: { cellWidth: 45, fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    y = doc.lastAutoTable.finalY + 10;
  }

  // Section 4: Practice Questions & Viva Prep
  if (quizData && quizData.questions?.length > 0) {
    if (y > pageHeight - 40) {
      doc.addPage();
      y = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.primary);
    doc.text(
      quizData.quiz_type === 'viva' ? '4. Viva Voce Oral Defense Questions' : '4. Self-Assessment Practice Questions',
      15,
      y
    );
    y += 6;

    quizData.questions.forEach((q, qIdx) => {
      if (y > pageHeight - 35) {
        doc.addPage();
        y = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(...COLORS.textDark);
      const qLines = doc.splitTextToSize(`Q${qIdx + 1}: ${q.question}`, contentWidth - 4);
      doc.text(qLines, 15, y);
      y += qLines.length * 4.2 + 2;

      if (quizData.quiz_type === 'viva') {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.5);
        doc.setTextColor(...COLORS.textMuted);
        const ansLines = doc.splitTextToSize(`Model Spoken Answer: "${q.modelAnswer}"`, contentWidth - 8);
        doc.text(ansLines, 19, y);
        y += ansLines.length * 3.8 + 2;

        if (q.keyPoints?.length > 0) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(...COLORS.primary);
          doc.text(`Keywords: ${q.keyPoints.join(' · ')}`, 19, y);
          y += 4.5;
        }
      } else if (q.options) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);

        q.options.forEach((opt, oIdx) => {
          const isCorrect = Number(q.correctAnswer) === oIdx;
          const optPrefix = `${String.fromCharCode(65 + oIdx)}) ${opt} ${isCorrect ? '✓ [Correct]' : ''}`;
          if (isCorrect) doc.setTextColor(...COLORS.emerald);
          else doc.setTextColor(71, 85, 105);
          doc.text(optPrefix, 20, y);
          y += 4;
        });

        if (q.explanation) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8);
          doc.setTextColor(...COLORS.textMuted);
          doc.text(`Explanation: ${q.explanation}`, 20, y);
          y += 4.5;
        }
      }

      y += 3;
    });
  }

  addPageDecorations(doc, filename);
  doc.save(`${(filename || 'document').replace(/\.[^/.]+$/, '')}-study-guide.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. EXPORT QUIZ SCORECARD REPORT TO PDF
// ─────────────────────────────────────────────────────────────────────────────
export function exportQuizScorecardPdf(filename, quiz, quizResult) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const contentWidth = pageWidth - 30;
  let y = 20;

  const score = quizResult?.score ?? quiz?.score ?? 0;
  const total = quizResult?.totalQuestions ?? quiz?.total_questions ?? 0;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const questions = quizResult?.questions || quiz?.questions || [];
  const userAnswers = quizResult?.userAnswers || quiz?.user_answers || [];

  // Header Banner
  doc.setFillColor(...COLORS.primary);
  doc.roundedRect(15, y, contentWidth, 26, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text('Assessment Scorecard & Analysis', 20, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(224, 231, 255);
  doc.text(`Document: ${filename || 'Document'}`, 20, y + 18);
  doc.text(`Completed on: ${new Date().toLocaleDateString()}`, pageWidth - 20, y + 18, { align: 'right' });

  y += 34;

  // Score Highlight Card
  doc.setFillColor(pct >= 70 ? 236 : 254, pct >= 70 ? 253 : 242, pct >= 70 ? 245 : 242);
  doc.setDrawColor(pct >= 70 ? 167 : 254, pct >= 70 ? 243 : 202, pct >= 70 ? 208 : 202);
  doc.roundedRect(15, y, contentWidth, 18, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(pct >= 70 ? 16 : 220, pct >= 70 ? 149 : 38, pct >= 70 ? 99 : 38);
  doc.text(`Final Score: ${score} / ${total} (${pct}%)`, 22, y + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.textMuted);
  doc.text(
    pct >= 80 ? 'Grade: Distinction (Excellent Mastery)' : pct >= 60 ? 'Grade: Pass (Good Recall)' : 'Grade: Needs Revision',
    pageWidth - 22,
    y + 11,
    { align: 'right' }
  );

  y += 26;

  // Question Breakdown
  questions.forEach((q, idx) => {
    const chosen = userAnswers?.[idx];
    const isCorrect = Number(chosen) === Number(q.correctAnswer);

    if (y > pageHeight - 35) {
      doc.addPage();
      y = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORS.textDark);
    const qLines = doc.splitTextToSize(`Question ${idx + 1}: ${q.question}`, contentWidth - 25);
    doc.text(qLines, 15, y);

    // Correct / Incorrect badge
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    if (isCorrect) {
      doc.setTextColor(...COLORS.emerald);
      doc.text('✓ CORRECT', pageWidth - 15, y, { align: 'right' });
    } else {
      doc.setTextColor(...COLORS.red);
      doc.text('✗ INCORRECT', pageWidth - 15, y, { align: 'right' });
    }

    y += qLines.length * 4.2 + 2;

    // Options
    q.options?.forEach((opt, oIdx) => {
      const isChosen = Number(chosen) === oIdx;
      const isRightOpt = Number(q.correctAnswer) === oIdx;

      doc.setFont('helvetica', isRightOpt ? 'bold' : 'normal');
      doc.setFontSize(8.5);

      if (isRightOpt) {
        doc.setTextColor(...COLORS.emerald);
        doc.text(`${String.fromCharCode(65 + oIdx)}) ${opt} (Correct Answer)`, 20, y);
      } else if (isChosen && !isCorrect) {
        doc.setTextColor(...COLORS.red);
        doc.text(`${String.fromCharCode(65 + oIdx)}) ${opt} (Your Answer)`, 20, y);
      } else {
        doc.setTextColor(100, 116, 139);
        doc.text(`${String.fromCharCode(65 + oIdx)}) ${opt}`, 20, y);
      }
      y += 4;
    });

    if (q.explanation) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.textMuted);
      const expLines = doc.splitTextToSize(`Explanation: ${q.explanation}`, contentWidth - 10);
      doc.text(expLines, 20, y);
      y += expLines.length * 3.8 + 1;
    }

    y += 5;
    doc.setDrawColor(...COLORS.border);
    doc.line(15, y - 2, pageWidth - 15, y - 2);
    y += 3;
  });

  addPageDecorations(doc, filename);
  doc.save(`${(filename || 'assessment').replace(/\.[^/.]+$/, '')}-quiz-report.pdf`);
}

/**
 * Generates an Executive System Analytics & RAG Observability Audit PDF
 */
export function exportAnalyticsReportPdf(analyticsData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const contentWidth = pageWidth - 30;
  let y = 20;

  const { overview, trends, documentAnalytics, health } = analyticsData || {};

  // Title Banner
  doc.setFillColor(...COLORS.primary);
  doc.roundedRect(15, y, contentWidth, 24, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('RAG-Doc-Chat Observability & Performance Audit', 22, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(224, 231, 255);
  doc.text(`Generated on ${new Date().toLocaleString()} · System Telemetry Report`, 22, y + 18);
  y += 32;

  // Section 1: Executive KPI Summary Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.textDark);
  doc.text('1. Executive KPI & RAG Economics Summary', 15, y);
  y += 4;

  const kpiData = [
    ['Total Documents Ingested', `${overview?.documents?.total || 0} files (${overview?.documents?.ready || 0} active/ready)`],
    ['Total Pages & Chunks Indexed', `${overview?.documents?.pages || 0} pages · ${overview?.documents?.chunks || 0} chunks`],
    ['Total RAG Queries Answered', `${overview?.activity?.totalQueries || 0} queries (${overview?.activity?.singleDocQueries || 0} single-doc, ${overview?.activity?.workspaceQueries || 0} workspace)`],
    ['RAG Token Efficiency & Savings', `${overview?.ragEconomics?.tokenSavingsPercent ?? 0}% token reduction vs full-document stuffing`],
    ['Est. Tokens Consumed with RAG', `${(overview?.ragEconomics?.estimatedTokensUsed || 0).toLocaleString()} tokens`],
    ['Est. Tokens without RAG (Full Stuffing)', `${(overview?.ragEconomics?.estimatedTokensWithoutRag || 0).toLocaleString()} tokens`],
    ['Average Retrieval & Synthesis Latency', `${overview?.ragEconomics?.avgLatencyMs ?? '—'} ms`],
    ['Quiz & Assessment Participation', `${overview?.quizPerformance?.completed || 0} completed (Avg Score: ${overview?.quizPerformance?.averageScorePercent || 0}%)`],
  ];

  autoTable(doc, {
    startY: y,
    head: [['System Metric', 'Recorded Telemetry Value']],
    body: kpiData,
    theme: 'grid',
    headStyles: { fillColor: COLORS.primary, textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8.5, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 70, fontStyle: 'bold' } },
    margin: { left: 15, right: 15 },
  });

  y = doc.lastAutoTable.finalY + 10;

  // Section 2: System & Vector Store Infrastructure Health
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.textDark);
  doc.text('2. System Infrastructure & LLM Cluster Health', 15, y);
  y += 4;

  const healthData = [
    ['Database Engine', `${health?.database?.engine || 'PostgreSQL'} (${health?.database?.status || 'healthy'}, Footprint: ${health?.database?.size || 'N/A'})`],
    ['Vector Store Cache', `${health?.vectorStore?.status || 'operational'} · ${health?.vectorStore?.totalVectors || 0} vectors (${health?.vectorStore?.dimension || 3072} dims, ${health?.vectorStore?.storagePretty || 'N/A'})`],
    ['Active AI Cluster', `Google Gemini (${health?.llmCluster?.status || 'operational'}) · Primary: ${health?.llmCluster?.primaryModel || 'gemini-3-flash-preview'}`],
    ['Available Failover Tiers', `${health?.llmCluster?.fallbackTiersAvailable || 5} resilient automated fallback models`],
    ['Node.js Runtime', `${health?.runtime?.nodeVersion || 'v24'} · Heap: ${health?.runtime?.heapUsedMB || 'N/A'} (Uptime: ${health?.runtime?.uptime || 'N/A'})`],
  ];

  autoTable(doc, {
    startY: y,
    head: [['Infrastructure Component', 'Operational Status & Telemetry']],
    body: healthData,
    theme: 'grid',
    headStyles: { fillColor: [45, 55, 72], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8.5, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 70, fontStyle: 'bold' } },
    margin: { left: 15, right: 15 },
  });

  y = doc.lastAutoTable.finalY + 10;

  // Section 3: Document Query Leaderboard
  if (y > 220) {
    doc.addPage();
    y = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.textDark);
  doc.text('3. Knowledge Base Utilization Leaderboard', 15, y);
  y += 4;

  const leaderboardRows = (documentAnalytics?.leaderboard || []).map((docItem, index) => [
    `#${index + 1}`,
    docItem.filename,
    `${docItem.pageCount} pgs / ${docItem.chunkCount} chunks`,
    `${docItem.queryCount} queries`,
    `${docItem.citationCount} citations`,
    docItem.status,
  ]);

  if (leaderboardRows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Rank', 'Document Name', 'Scale', 'User Queries', 'Citations', 'Status']],
      body: leaderboardRows,
      theme: 'striped',
      headStyles: { fillColor: COLORS.secondary, textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: { 0: { cellWidth: 15 }, 1: { cellWidth: 65 } },
      margin: { left: 15, right: 15 },
    });
  }

  addPageDecorations(doc, 'System Analytics Report');
  doc.save(`rag-system-analytics-audit-${new Date().toISOString().slice(0, 10)}.pdf`);
}

