import BrandMark from './BrandMark';

/**
 * Two-column frame for login / signup. The left side shows what the app
 * actually does — a passage, a question, and an answer that points back to
 * the page it came from — instead of marketing copy.
 */
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

          {/* A worked example, rendered like a page from the user's own file */}
          <figure className="mt-auto pt-10">
            <div className="rounded-lg bg-slate-50 text-slate-700 p-4 font-serif text-[13px] leading-relaxed shadow-lg">
              <p>
                The light reactions take place in the thylakoid membranes.{' '}
                <mark className="bg-[#f2dd8c] text-slate-900 rounded-sm px-0.5">
                  The Calvin cycle then runs in the stroma
                </mark>
                , using ATP and NADPH to fix carbon dioxide.
              </p>
              <p className="mt-2 text-right text-[11px] text-slate-400 font-sans">Biology notes, p. 2</p>
            </div>
            <figcaption className="mt-4 space-y-2 text-sm">
              <p className="text-indigo-200">“Where does the Calvin cycle happen?”</p>
              <p className="text-white">
                In the stroma of the chloroplast.{' '}
                <span className="ml-1 inline-block rounded bg-indigo-700 px-1.5 py-0.5 text-[11px] text-indigo-100">
                  p. 2
                </span>
              </p>
            </figcaption>
          </figure>
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
