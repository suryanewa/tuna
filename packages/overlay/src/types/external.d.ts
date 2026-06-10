declare module "react-speech-recognition" {
  type StartListeningOptions = {
    continuous?: boolean;
    language?: string;
  };

  const SpeechRecognition: {
    startListening: (options?: StartListeningOptions) => Promise<void>;
    stopListening: () => Promise<void>;
    abortListening: () => Promise<void>;
  };

  export function useSpeechRecognition(options?: {
    clearTranscriptOnListen?: boolean;
  }): {
    transcript: string;
    listening: boolean;
    resetTranscript: () => void;
    browserSupportsSpeechRecognition: boolean;
  };

  export default SpeechRecognition;
}

declare module "@xenova/transformers" {
  export function pipeline(
    task: "automatic-speech-recognition",
    model: string,
  ): Promise<(input: { raw: Float32Array; sampling_rate: number }) => Promise<string | { text?: string }>>;
}
