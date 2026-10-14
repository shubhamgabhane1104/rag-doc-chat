import React from 'react';
import { Volume2, VolumeX, Pause, Play, Square, FastForward } from 'lucide-react';

export default function AudioMessagePlayer({
  messageId,
  content,
  isSpeaking,
  isPaused,
  activeMessageId,
  speechRate,
  setSpeechRate,
  onSpeak,
  onPause,
  onResume,
  onStop,
  className = '',
}) {
  const isThisActive = activeMessageId === messageId;

  const handleToggle = () => {
    if (isThisActive) {
      if (isPaused) {
        onResume();
      } else if (isSpeaking) {
        onPause();
      }
    } else {
      onSpeak(messageId, content);
    }
  };

  const handleCycleSpeed = (e) => {
    e.stopPropagation();
    const speeds = [0.8, 1.0, 1.25, 1.5];
    const nextIdx = (speeds.indexOf(speechRate) + 1) % speeds.length;
    setSpeechRate(speeds[nextIdx]);
  };

  return (
    <div className={`inline-flex items-center gap-1.5 transition-all ${className}`}>
      {isThisActive ? (
        /* Active Mini Audio Player Pill */
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200/80 dark:border-indigo-800/80 text-indigo-700 dark:text-indigo-300 text-xs shadow-xs">
          {/* Animated Equalizer Wave */}
          {!isPaused && (
            <div className="flex items-center gap-0.5 h-3 px-1">
              <span className="w-0.5 h-2 bg-indigo-500 rounded-full animate-pulse [animation-duration:0.4s]"></span>
              <span className="w-0.5 h-3.5 bg-indigo-600 rounded-full animate-pulse [animation-duration:0.6s]"></span>
              <span className="w-0.5 h-1.5 bg-indigo-400 rounded-full animate-pulse [animation-duration:0.3s]"></span>
              <span className="w-0.5 h-3 bg-indigo-500 rounded-full animate-pulse [animation-duration:0.5s]"></span>
            </div>
          )}

          {/* Play/Pause Button */}
          <button
            type="button"
            onClick={handleToggle}
            className="p-1 hover:bg-indigo-200/50 dark:hover:bg-indigo-800/50 rounded-full transition"
            title={isPaused ? 'Resume speaking' : 'Pause speaking'}
          >
            {isPaused ? <Play size={12} className="fill-current" /> : <Pause size={12} />}
          </button>

          {/* Stop Button */}
          <button
            type="button"
            onClick={onStop}
            className="p-1 hover:bg-indigo-200/50 dark:hover:bg-indigo-800/50 rounded-full transition text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400"
            title="Stop audio readout"
          >
            <Square size={11} className="fill-current" />
          </button>

          {/* Playback Speed Pill */}
          <button
            type="button"
            onClick={handleCycleSpeed}
            className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900 transition"
            title="Click to change reading speed (0.8x, 1x, 1.25x, 1.5x)"
          >
            {speechRate}x
          </button>
        </div>
      ) : (
        /* Inactive "Read Aloud" Button */
        <button
          type="button"
          onClick={() => onSpeak(messageId, content)}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-slate-400 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition"
          title="Read answer aloud (Text-to-Speech)"
        >
          <Volume2 size={13} />
          <span>Read Aloud</span>
        </button>
      )}
    </div>
  );
}
