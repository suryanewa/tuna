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
  toggleDictation: () => void;
};

export function useCommentDictation(onTranscriptDelta: (text: string) => void): CommentDictationState {
  const insertedLengthRef = useRef(0);
  const recordingStopRef = useRef<(() => Promise<Blob>) | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [dictationError, setDictationError] = useState<string | null>(null);

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

  const stopWhisperRecording = useCallback(async () => {
    const stop = recordingStopRef.current;
    if (!stop) return;
    recordingStopRef.current = null;
    setIsRecording(false);
    setIsTranscribing(true);
    try {
      const blob = await stop();
      const text = await transcribeRecordedAudio(blob);
      if (text) onTranscriptDelta(text.endsWith(" ") ? text : `${text} `);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Transcription failed.";
      setDictationError(message);
    } finally {
      setIsTranscribing(false);
    }
  }, [onTranscriptDelta]);

  const stopDictation = useCallback(() => {
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

  const startDictation = useCallback(async () => {
    setDictationError(null);

    if (browserSupportsSpeechRecognition) {
      insertedLengthRef.current = 0;
      resetTranscript();
      try {
        await SpeechRecognition.startListening({ continuous: true, language: "en-US" });
      } catch {
        setDictationError("Could not start speech recognition. Check microphone permissions.");
      }
      return;
    }

    try {
      const session = await startAudioRecording();
      recordingStopRef.current = session.stop;
      setIsRecording(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Microphone unavailable.";
      setDictationError(message);
    }
  }, [browserSupportsSpeechRecognition, resetTranscript]);

  const toggleDictation = useCallback(() => {
    if (listening || isRecording || isTranscribing) {
      stopDictation();
      return;
    }
    void startDictation();
  }, [isRecording, isTranscribing, listening, startDictation, stopDictation]);

  useEffect(() => () => {
    SpeechRecognition.stopListening();
    recordingStopRef.current = null;
  }, []);

  return {
    isDictating: listening || isRecording || isTranscribing,
    isTranscribing,
    usesWhisperFallback,
    dictationError,
    toggleDictation,
  };
}
