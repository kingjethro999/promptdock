"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";

type Transcription = { text: string };

type VoiceOptions = {
  /** Stop and transcribe on their own after this long. */
  maxSeconds?: number;
};

export function useVoiceIdea(
  onText: (value: string, reason: "stopped" | "limit") => void,
  options: VoiceOptions = {},
) {
  const maxSeconds = options.maxSeconds ?? 0;
  const [phase, setPhase] = useState<"idle" | "recording" | "sending">("idle");
  const [elapsed, setElapsed] = useState(0);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopReason = useRef<"stopped" | "limit">("stopped");
  const [message, setMessage] = useState("Checking voice availability…");
  const [available, setAvailable] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const tracks = useRef<MediaStream | null>(null);
  const discard = useRef(false);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => {
    let active = true;
    api<{ voiceAvailable: boolean }>("/api/status")
      .then((status) => {
        if (!active) return;
        const supported =
          Boolean(navigator.mediaDevices?.getUserMedia) &&
          typeof MediaRecorder !== "undefined";
        setAvailable(status.voiceAvailable && supported);
        setMessage(
          !status.voiceAvailable
            ? "Voice requires a Groq key, yours or PromptDock’s."
            : !supported
              ? "This browser cannot record audio here. Try typing your idea."
              : "Speak your idea. Audio goes to Groq only after Stop & send.",
        );
      })
      .catch(() => {
        if (active)
          setMessage(
            "Voice availability could not be checked. Try again later.",
          );
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () => () => {
      if (ticker.current) clearInterval(ticker.current);
      discard.current = true;
      if (recorder.current?.state === "recording") recorder.current.stop();
      tracks.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  async function start() {
    if (!available) return;
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setMessage(
        "This browser cannot record audio here. Try typing your idea.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      tracks.current = stream;
      const type = ["audio/webm", "audio/ogg", "audio/mp4"].find((item) =>
        MediaRecorder.isTypeSupported(item),
      );
      // 32 kbps speech keeps a 10 minute recording near 2.4 MB, inside the
      // 4 MB upload limit, and is plenty for transcription.
      const instance = new MediaRecorder(stream, {
        ...(type ? { mimeType: type } : {}),
        audioBitsPerSecond: 32000,
      });
      const chunks: Blob[] = [];
      discard.current = false;
      instance.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      instance.onstop = async () => {
        if (ticker.current) clearInterval(ticker.current);
        ticker.current = null;
        stream.getTracks().forEach((track) => track.stop());
        tracks.current = null;
        if (discard.current) {
          setPhase("idle");
          setMessage("Recording discarded.");
          return;
        }
        const audio = new Blob(chunks, {
          type: instance.mimeType || "audio/webm",
        });
        if (audio.size > 4_000_000) {
          setPhase("idle");
          setMessage("Recording is too large. Keep it under 4 MB.");
          return;
        }
        try {
          const result = await api<Transcription>("/api/transcribe", {
            method: "POST",
            headers: { "Content-Type": audio.type },
            body: audio,
          });
          onTextRef.current(result.text, stopReason.current);
          setMessage("Idea transcribed. Review it before generating.");
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Could not transcribe this recording.",
          );
        } finally {
          setPhase("idle");
        }
      };
      recorder.current = instance;
      instance.start(1000);
      stopReason.current = "stopped";
      setElapsed(0);
      const startedAt = Date.now();
      ticker.current = setInterval(() => {
        const seconds = Math.floor((Date.now() - startedAt) / 1000);
        setElapsed(seconds);
        if (maxSeconds && seconds >= maxSeconds) {
          stopReason.current = "limit";
          stop(true);
        }
      }, 250);
      setPhase("recording");
      setMessage("Recording… Choose Stop & send when ready.");
    } catch {
      setMessage(
        "Microphone access was denied. Allow it in your browser settings.",
      );
    }
  }

  function stop(send = true) {
    if (recorder.current?.state !== "recording") return;
    discard.current = !send;
    setPhase(send ? "sending" : "idle");
    recorder.current.stop();
  }

  return { phase, message, available, elapsed, maxSeconds, start, stop };
}
