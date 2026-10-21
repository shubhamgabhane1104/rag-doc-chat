import { Component } from 'react';

/**
 * Catches a crash while drawing a page. Without this, one error in any page
 * unmounts the whole app and leaves a blank white screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Something went wrong on this page</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            Your documents and results are safe. Reload the page or go back to your documents.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-indigo-700 text-white text-sm font-medium hover:bg-indigo-800"
            >
              Reload page
            </button>
            <button
              onClick={() => { window.location.href = '/dashboard'; }}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              My documents
            </button>
          </div>
        </div>
      </div>
    );
  }
}
