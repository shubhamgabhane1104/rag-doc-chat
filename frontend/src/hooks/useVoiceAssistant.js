import { useState, useEffect, useRef, useCallback } from 'react';
import { cleanTextForSpeech, getPreferredVoice } from '../utils/voiceUtils';

/**
 * Custom React Hook providing both Speech-to-Text (STT) and Text-to-Speech (TTS)
 */
export function useVoiceAssistant() {
  // ─── SPEECH-TO-TEXT (STT) STATE ─────────────────────────────
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [sttSupported, setSttSupported] = useState(false);
  const [sttError, setSttError] = useState('');
  const recognitionRef = useRef(null);

  // ─── TEXT-TO-SPEECH (TTS) STATE ─────────────────────────────
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeMessageId, setActiveMessageId] = useState(null);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [ttsSupported, setTtsSupported] = useState(false);

  // Check browser API support on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasSTT = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
      const hasTTS = !!window.speechSynthesis;
      setSttSupported(hasSTT);
      setTtsSupported(hasTTS);
    }
  }, []);

  // ─── STT METHODS ────────────────────────────────────────────

  /**
   * Starts microphone recording and speech recognition
   * @param {function} onResultCallback - Called with the latest transcribed text
   */
  const startListening = useCallback(
    (onResultCallback) => {
      setSttError('');

      if (typeof window === 'undefined') return;
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognition) {
        setSttError('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
        return;
      }

      // Stop any existing session
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }

      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        let accumulatedText = '';

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event) => {
          let interimText = '';
          let finalText = '';

          for (let i = 0; i < event.results.length; i++) {
            const transcriptPart = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalText += transcriptPart + ' ';
            } else {
              interimText += transcriptPart;
            }
          }

          const currentTotal = (finalText + interimText).trim();
          setTranscript(currentTotal);

          if (onResultCallback && currentTotal) {
            onResultCallback(currentTotal);
          }
        };

        recognition.onerror = (event) => {
          console.warn('Speech recognition error:', event.error);
          if (event.error === 'not-allowed') {
            setSttError('Microphone permission was denied. Please allow microphone access in your browser.');
          } else if (event.error !== 'no-speech') {
            setSttError(`Voice error: ${event.error}`);
          }
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
        setSttError('Could not start microphone.');
        setIsListening(false);
      }
    },
    []
  );

  /**
   * Stops microphone recording
   */
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  // ─── TTS METHODS ────────────────────────────────────────────

  /**
   * Cancels and stops any active speech readout
   */
  const stopSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setIsPaused(false);
    setActiveMessageId(null);
  }, []);

  /**
   * Speaks a specific text snippet for a given message ID
   */
  const speakText = useCallback(
    (messageId, rawText) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) return;

      // If already speaking this message, stop it (toggle)
      if (activeMessageId === messageId && isSpeaking) {
        stopSpeech();
        return;
      }

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const cleanedText = cleanTextForSpeech(rawText);
      if (!cleanedText) return;

      const utterance = new SpeechSynthesisUtterance(cleanedText);
      const voice = getPreferredVoice();
      if (voice) utterance.voice = voice;

      utterance.rate = speechRate;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        setIsSpeaking(true);
        setIsPaused(false);
        setActiveMessageId(messageId);
      };

      utterance.onpause = () => {
        setIsPaused(true);
      };

      utterance.onresume = () => {
        setIsPaused(false);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        setActiveMessageId(null);
      };

      utterance.onerror = (e) => {
        console.warn('Speech synthesis error:', e);
        setIsSpeaking(false);
        setIsPaused(false);
        setActiveMessageId(null);
      };

      window.speechSynthesis.speak(utterance);
    },
    [activeMessageId, isSpeaking, speechRate, stopSpeech]
  );

  /**
   * Pauses active speech
   */
  const pauseSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  }, []);

  /**
   * Resumes paused speech
   */
  const resumeSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    // STT
    isListening,
    transcript,
    sttSupported,
    sttError,
    startListening,
    stopListening,

    // TTS
    isSpeaking,
    isPaused,
    activeMessageId,
    speechRate,
    setSpeechRate,
    ttsSupported,
    speakText,
    pauseSpeech,
    resumeSpeech,
    stopSpeech,
  };
}
