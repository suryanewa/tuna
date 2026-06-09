import { useCallback, useEffect, useRef, useState } from "react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { startAudioRecording, transcribeRecordedAudio } from "./whisper-dictation";

export function getTranscriptDelta(previousLength: number, transcript: string): string {
  return transcript.slice(previousLength);
}

export type CommentDictationState = {
  isDictating: boolean;
  isTranscribing: boolean;
  usesWhisperFallback: boolean;
  dictationError: string | null;
  visualizationStream: MediaStream | null;
  toggleDictation: () => void;
  confirmDictation: () => void;
  cancelDictation: () => void;
};

export function useCommentDictation(onTranscriptDelta: (text: string) => void): CommentDictationState {
  const insertedLengthRef = useRef(0);
  const recordingStopRef = useRef<(() => Promise<Blob>) | null>(null);
  const sessionRef = useRef(0);
  const transcriptionGenerationRef = useRef(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [dictationError, setDictationError] = useState<string | null>(null);
  const [visualizationStream, setVisualizationStream] = useState<MediaStream | null>(null);

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition({ clearTranscriptOnListen: false });

  const usesWhisperFallback = !browserSupportsSpeechRecognition;

  const flushPendingTranscript = useCallback(() => {
    const delta = getTranscriptDelta(insertedLengthRef.current, transcript);
    if (!delta) return;
    onTranscriptDelta(delta);
    insertedLengthRef.current = transcript.length;
  }, [onTranscriptDelta, transcript]);

  // Stream interim + final transcript into the editor while listening.
  useEffect(() => {
    if (!listening) return;
    flushPendingTranscript();
  }, [listening, transcript, flushPendingTranscript]);

  const clearVisualizationStream = useCallback(() => {
    setVisualizationStream(null);
  }, []);

  const abortWhisperRecording = useCallback(async () => {
    const stop = recordingStopRef.current;
    if (!stop) return;
    recordingStopRef.current = null;
    setIsRecording(false);
    clearVisualizationStream();
    try {
      await stop();
    } catch {
      // Discard recording blob on cancel.
    }
  }, [clearVisualizationStream]);

  const stopWhisperRecording = useCallback(async () => {
    const stop = recordingStopRef.current;
    if (!stop) return;
    recordingStopRef.current = null;
    setIsRecording(false);
    clearVisualizationStream();
    const generation = transcriptionGenerationRef.current;
    setIsTranscribing(true);
    try {
      const blob = await stop();
      const text = await transcribeRecordedAudio(blob);
      if (generation !== transcriptionGenerationRef.current) return;
      if (text) onTranscriptDelta(text.endsWith(" ") ? text : `${text} `);
    } catch (error) {
      if (generation !== transcriptionGenerationRef.current) return;
      const message = error instanceof Error ? error.message : "Transcription failed.";
      setDictationError(message);
    } finally {
      if (generation === transcriptionGenerationRef.current) {
        setIsTranscribing(false);
      }
    }
  }, [clearVisualizationStream, onTranscriptDelta]);

  const confirmDictation = useCallback(() => {
    if (listening) {
      flushPendingTranscript();
      insertedLengthRef.current = 0;
      void SpeechRecognition.stopListening();
      return;
    }
    if (recordingStopRef.current) {
      void stopWhisperRecording();
    }
  }, [flushPendingTranscript, listening, stopWhisperRecording]);

  const cancelDictation = useCallback(() => {
    sessionRef.current += 1;
    transcriptionGenerationRef.current += 1;
    insertedLengthRef.current = 0;
    setDictationError(null);
    setIsTranscribing(false);

    // Order matters: abort BEFORE resetTranscript. abortListening() only arms the
    // anti-restart flag (pauseAfterDisconnect) while the manager still believes it
    // is listening. resetTranscript() issues a RESET disconnect that flips the
    // manager's listening flag to false AND clears pauseAfterDisconnect — doing it
    // first would make abort a no-op and let continuous-mode auto-restart on `onend`.
    void SpeechRecognition.abortListening();
    resetTranscript();
    if (recordingStopRef.current) {
      void abortWhisperRecording();
    }
  }, [abortWhisperRecording, resetTranscript]);

  const startDictation = useCallback(async () => {
    const session = sessionRef.current + 1;
    sessionRef.current = session;
    setDictationError(null);

    if (browserSupportsSpeechRecognition) {
      insertedLengthRef.current = 0;
      resetTranscript();
      try {
        await SpeechRecognition.startListening({ continuous: true, language: "en-US" });
        if (session !== sessionRef.current) {
          void SpeechRecognition.stopListening();
        }
      } catch {
        if (session === sessionRef.current) {
          setDictationError("Could not start speech recognition. Check microphone permissions.");
        }
      }
      return;
    }

    try {
      const recorderSession = await startAudioRecording();
      if (session !== sessionRef.current) {
        void recorderSession.stop().catch(() => {});
        return;
      }
      recordingStopRef.current = recorderSession.stop;
      setVisualizationStream(recorderSession.stream);
      setIsRecording(true);
    } catch (error) {
      if (session !== sessionRef.current) return;
      const message = error instanceof Error ? error.message : "Microphone unavailable.";
      setDictationError(message);
    }
  }, [browserSupportsSpeechRecognition, resetTranscript]);

  const toggleDictation = useCallback(() => {
    if (listening || isRecording || isTranscribing) {
      confirmDictation();
      return;
    }
    void startDictation();
  }, [confirmDictation, isRecording, isTranscribing, listening, startDictation]);

  useEffect(() => () => {
    sessionRef.current += 1;
    transcriptionGenerationRef.current += 1;
    void SpeechRecognition.stopListening();
    if (recordingStopRef.current) {
      void abortWhisperRecording();
    } else {
      clearVisualizationStream();
    }
  }, [abortWhisperRecording, clearVisualizationStream]);

  return {
    isDictating: listening || isRecording || isTranscribing,
    isTranscribing,
    usesWhisperFallback,
    dictationError,
    visualizationStream,
    toggleDictation,
    confirmDictation,
    cancelDictation,
  };
}
