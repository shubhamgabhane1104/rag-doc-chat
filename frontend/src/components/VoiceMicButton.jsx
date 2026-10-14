import React from 'react';
import { Mic, MicOff, AlertCircle } from 'lucide-react';

export default function VoiceMicButton({
  isListening,
  onStart,
  onStop,
  sttSupported,
  errorMessage,
  className = '',
}) {
  const handleClick = (e) => {
    e.preventDefault();
    if (isListening) {
      onStop();
    } else {
      onStart();
    }
  };

  if (!sttSupported) {
    return null; // Gracefully hidden on unsupported browsers
  }

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={handleClick}
        title={
          isListening
            ? 'Listening... Click to stop voice input'
            : 'Voice Input (Hands-free Speech-to-Text)'
        }
        className={`relative p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center shrink-0 ${
          isListening
            ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30 ring-4 ring-red-400/30 animate-pulse'
            : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700/60'
        } ${className}`}
      >
        {isListening ? (
          <div className="flex items-center gap-1">
            {/* Animated mic soundwave bars */}
            <span className="w-0.5 h-3 bg-white rounded-full animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-0.5 h-4 bg-white rounded-full animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-0.5 h-3 bg-white rounded-full animate-bounce"></span>
            <MicOff size={16} className="ml-1" />
          </div>
        ) : (
          <Mic size={18} />
        )}
      </button>

      {/* Error Alert Bubble */}
      {errorMessage && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 p-2 rounded-lg bg-red-600 text-white text-[11px] shadow-lg flex items-center gap-1.5 z-30 pointer-events-none">
          <AlertCircle size={14} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
