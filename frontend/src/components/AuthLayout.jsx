import { FileUp, MessageSquareQuote, NotebookText, GraduationCap, FolderKanban } from 'lucide-react';
import BrandMark from './BrandMark';

// What a new user can actually do in DocChat, shown on the login / signup page
const FEATURES = [
  { icon: FileUp, title: 'Upload your files', text: 'PDF, Word, PowerPoint, Excel or text, up to 20 MB.' },
  { icon: MessageSquareQuote, title: 'Ask in plain English', text: 'Answers come only from your document, with page numbers.' },
  { icon: NotebookText, title: 'Get a summary', text: 'Key points and a glossary of important terms.' },
  { icon: GraduationCap, title: 'Practise for exams', text: 'Generate MCQ quizzes and viva questions.' },
  { icon: FolderKanban, title: 'Search several files at once', text: 'Group documents into a workspace and ask across all of them.' },
];

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-4xl grid md:grid-cols-[1.05fr_1fr] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
        <aside className="hidden md:flex flex-col bg-indigo-800 text-indigo-50 p-10">
          <div className="flex items-center gap-2.5 text-white">
            <BrandMark size={30} detail="#163f3d" />
            <span className="font-serif text-xl font-semibold tracking-tight">DocChat</span>
          </div>

          <h1 className="mt-10 text-[1.7rem] leading-snug font-semibold text-white">
            Ask your notes a question. Get the answer and the page it came from.
          </h1>

          <ul className="mt-auto pt-10 space-y-4">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-700 text-indigo-100">
                  <Icon size={16} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-[13px] leading-snug text-indigo-200">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <main className="p-8 sm:p-10 flex flex-col justify-center">
          <div className="flex md:hidden items-center gap-2 mb-8 text-indigo-700 dark:text-indigo-300">
            <BrandMark size={26} />
            <span className="font-serif text-lg font-semibold text-slate-900 dark:text-white">DocChat</span>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
