/**
 * Offline dictation fallback using Whisper (via @xenova/transformers).
 * Loaded only when the Web Speech API is unavailable.
 */

const WHISPER_MODEL = "Xenova/whisper-tiny.en";

type AudioRecorderSession = {
  stop: () => Promise<Blob>;
};

export async function startAudioRecording(): Promise<AudioRecorderSession> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone access is not available in this browser.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "";

  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: BlobPart[] = [];

  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });

  const stop = () => new Promise<Blob>((resolve, reject) => {
    recorder.addEventListener("stop", () => {
      stream.getTracks().forEach((track) => track.stop());
      resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
    }, { once: true });
    recorder.addEventListener("error", () => {
      stream.getTracks().forEach((track) => track.stop());
      reject(new Error("Audio recording failed."));
    }, { once: true });
    if (recorder.state === "inactive") {
      stream.getTracks().forEach((track) => track.stop());
      resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
      return;
    }
    recorder.stop();
  });

  recorder.start();
  return { stop };
}

async function decodeAudioBlob(blob: Blob): Promise<{ audio: Float32Array; sampling_rate: number }> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext();
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const channel = audioBuffer.numberOfChannels > 1
      ? mixToMono(audioBuffer)
      : audioBuffer.getChannelData(0);
    const targetRate = 16_000;
    const audio = audioBuffer.sampleRate === targetRate
      ? channel
      : resampleAudio(channel, audioBuffer.sampleRate, targetRate);
    return { audio, sampling_rate: targetRate };
  } finally {
    await audioContext.close();
  }
}

function mixToMono(audioBuffer: AudioBuffer): Float32Array {
  const length = audioBuffer.length;
  const mixed = new Float32Array(length);
  const channelCount = audioBuffer.numberOfChannels;
  for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
    const channel = audioBuffer.getChannelData(channelIndex);
    for (let i = 0; i < length; i += 1) {
      mixed[i] += channel[i] / channelCount;
    }
  }
  return mixed;
}

function resampleAudio(
  samples: Float32Array,
  sourceRate: number,
  targetRate: number,
): Float32Array {
  if (sourceRate === targetRate) return samples;
  const ratio = sourceRate / targetRate;
  const outputLength = Math.max(1, Math.round(samples.length / ratio));
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i += 1) {
    const sourceIndex = i * ratio;
    const lower = Math.floor(sourceIndex);
    const upper = Math.min(lower + 1, samples.length - 1);
    const weight = sourceIndex - lower;
    output[i] = samples[lower] * (1 - weight) + samples[upper] * weight;
  }
  return output;
}

export async function transcribeRecordedAudio(blob: Blob): Promise<string> {
  let transformers: typeof import("@xenova/transformers");
  try {
    transformers = await import("@xenova/transformers");
  } catch {
    throw new Error(
      "Offline dictation requires @xenova/transformers. Install it in your app or use Chrome for built-in speech recognition.",
    );
  }

  const { audio, sampling_rate } = await decodeAudioBlob(blob);
  if (audio.length === 0) return "";

  const transcriber = await transformers.pipeline("automatic-speech-recognition", WHISPER_MODEL);
  const result = await transcriber({ raw: audio, sampling_rate });
  if (typeof result === "string") return result.trim();
  if (result && typeof result === "object" && "text" in result && typeof result.text === "string") {
    return result.text.trim();
  }
  return "";
}
