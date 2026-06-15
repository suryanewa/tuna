import { useCallback, useEffect, useRef } from "react";

export function AudioWaveform({
  isDictating,
  mediaStream,
  useSharedMicOnly,
}: {
  isDictating: boolean;
  mediaStream?: MediaStream | null;
  /** When true, only visualize `mediaStream` (no extra getUserMedia). */
  useSharedMicOnly?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const ownedStreamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const historyRef = useRef<number[]>([]);

  const drawIdleBars = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const width = rect.width;
    const height = rect.height;
    const barWidth = 2;
    const barGap = 2;
    const totalBarWidth = barWidth + barGap;
    const numBars = Math.floor(width / totalBarWidth);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = window.getComputedStyle(canvas).color || "rgb(120, 120, 120)";
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < numBars; i++) {
      const x = i * totalBarWidth;
      const normalizedHeight = 2;
      const y = (height - normalizedHeight) / 2;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(x, y, barWidth, normalizedHeight, 1);
      } else {
        ctx.rect(x, y, barWidth, normalizedHeight);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, []);

  useEffect(() => {
    if (!isDictating) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      if (ownedStreamRef.current) {
        ownedStreamRef.current.getTracks().forEach((track) => track.stop());
        ownedStreamRef.current = null;
      }
      historyRef.current = [];
      const canvas = canvasRef.current;
      if (canvas) drawIdleBars(canvas);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let active = true;
    let lastHistoryUpdate = 0;
    const frameInterval = 60;
    let syntheticPhase = 0;
    let layoutWidth = 0;
    let layoutHeight = 0;
    const barWidth = 2;
    const barGap = 2;
    const totalBarWidth = barWidth + barGap;

    let barColor = window.getComputedStyle(canvas).color || "rgb(120, 120, 120)";

    const measureCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return 0;
      const dpr = window.devicePixelRatio || 1;
      if (rect.width !== layoutWidth || rect.height !== layoutHeight) {
        layoutWidth = rect.width;
        layoutHeight = rect.height;
        canvas.width = Math.floor(layoutWidth * dpr);
        canvas.height = Math.floor(layoutHeight * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      return Math.floor(layoutWidth / totalBarWidth);
    };

    const renderBars = (amplitude: number, pushHistory: boolean) => {
      const numBars = measureCanvas();
      if (numBars <= 0) return;
      if (pushHistory) {
        historyRef.current.push(amplitude);
        if (historyRef.current.length > numBars) historyRef.current.shift();
      }
      ctx.clearRect(0, 0, layoutWidth, layoutHeight);
      for (let i = 0; i < numBars; i++) {
        const x = i * totalBarWidth;
        const historyIndex = historyRef.current.length - numBars + i;
        const amp = historyIndex >= 0 ? historyRef.current[historyIndex] : 0;
        const normalizedHeight = Math.max(2, amp * layoutHeight);
        const y = (layoutHeight - normalizedHeight) / 2;
        ctx.fillStyle = barColor;
        ctx.globalAlpha = amp > 0.05 ? 1 : 0.3;
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(x, y, barWidth, normalizedHeight, 1);
        } else {
          ctx.rect(x, y, barWidth, normalizedHeight);
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    let readAmplitude: (() => number) | null = null;

    const resizeObserver = new ResizeObserver(() => {
      barColor = window.getComputedStyle(canvas).color || barColor;
      renderBars(0, false);
    });
    resizeObserver.observe(canvas);

    async function initAudio() {
      try {
        let stream = mediaStream ?? null;
        let ownsStream = false;
        if (!stream && !useSharedMicOnly) {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          ownsStream = true;
          ownedStreamRef.current = stream;
        }
        if (!active) {
          if (ownsStream) stream?.getTracks().forEach((track) => track.stop());
          return;
        }
        if (!stream) return;

        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return;
        const audioContext = new AudioContextClass();
        audioContextRef.current = audioContext;
        await audioContext.resume();

        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        readAmplitude = () => {
          analyser.getByteTimeDomainData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += Math.abs(dataArray[i] - 128);
          }
          return Math.min(1, (sum / bufferLength) / 40);
        };
      } catch (err) {
        console.error("Error initializing audio visualizer:", err);
      }
    }

    void initAudio();

    const tick = (timestamp: number) => {
      if (!active) return;
      animationRef.current = requestAnimationFrame(tick);
      if (measureCanvas() <= 0) return;

      if (timestamp - lastHistoryUpdate >= frameInterval) {
        let amplitude = 0.05;
        if (readAmplitude) {
          amplitude = readAmplitude();
        } else {
          syntheticPhase += 0.12;
          amplitude = 0.08 + (Math.sin(syntheticPhase) + 1) * 0.12;
        }
        renderBars(amplitude, true);
        lastHistoryUpdate = timestamp;
      } else {
        renderBars(0, false);
      }
    };

    animationRef.current = requestAnimationFrame(tick);

    return () => {
      active = false;
      resizeObserver?.disconnect();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      if (ownedStreamRef.current) {
        ownedStreamRef.current.getTracks().forEach((track) => track.stop());
        ownedStreamRef.current = null;
      }
      analyserRef.current = null;
    };
  }, [drawIdleBars, isDictating, mediaStream, useSharedMicOnly]);

  return (
    <canvas
      ref={canvasRef}
      className="tuna-comment-waveform-canvas"
    />
  );
}
