import React, { useCallback, useEffect, useRef, useState } from "react";
import { GoogleGenAI, Modality } from "@google/genai";
import LiveChatBubble, { LiveMessage } from "./LiveChatBubble";
import LogoutButton from "./LogoutButton";
import { CLINICAL_SYSTEM_INSTRUCTION } from "../constants";

type LiveSession = any;

const apiKey =
  (import.meta as any)?.env?.VITE_GEMINI_API_KEY ??
  (process as any)?.env?.API_KEY ??
  undefined;

const LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";
const LIVE_SAMPLE_RATE = 24000;

const AudioLiveChat: React.FC = () => {
  const [session, setSession] = useState<LiveSession | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [isMicOn, setIsMicOn] = useState(false);

  const sessionRef = useRef<LiveSession | null>(null);
  const aiRef = useRef<GoogleGenAI | null>(null);

  // USER audio capture (for saving WAV)
  const micStreamRef = useRef<MediaStream | null>(null);
  const captureCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const userPcm16ChunksRef = useRef<Int16Array[]>([]);

  // BOT audio+transcript buffers
  const botTranscriptRef = useRef("");
  const botPcm16ChunksRef = useRef<Int16Array[]>([]);

  // Web Speech STT
  const recognitionRef = useRef<any>(null);
  const sttSentRef = useRef(false);
  const finalizedTurnRef = useRef(false);

  // Bot playback
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const playheadRef = useRef<number>(0);

  const getAi = () => {
    if (!aiRef.current) aiRef.current = new GoogleGenAI({ apiKey });
    return aiRef.current;
  };

  const pcm16ToWavBlob = (chunks: Int16Array[], sampleRate: number) => {
    const totalSamples = chunks.reduce((sum, c) => sum + c.length, 0);
    const pcm = new Int16Array(totalSamples);
    let offset = 0;
    for (const c of chunks) {
      pcm.set(c, offset);
      offset += c.length;
    }

    const bytesPerSample = 2;
    const blockAlign = 1 * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcm.length * bytesPerSample;

    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (o: number, s: string) => {
      for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, "WAVE");

    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);

    writeString(36, "data");
    view.setUint32(40, dataSize, true);

    let pos = 44;
    for (let i = 0; i < pcm.length; i++, pos += 2) {
      view.setInt16(pos, pcm[i], true);
    }

    return new Blob([buffer], { type: "audio/wav" });
  };

  const decodeBase64ToInt16 = (b64: string) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Int16Array(bytes.buffer);
  };

  const ensurePlaybackCtx = async () => {
    if (!playbackCtxRef.current) {
      playbackCtxRef.current = new (
        window.AudioContext || (window as any).webkitAudioContext
      )({ sampleRate: LIVE_SAMPLE_RATE });
      playheadRef.current = playbackCtxRef.current.currentTime;
    }
    if (playbackCtxRef.current.state === "suspended") {
      await playbackCtxRef.current.resume();
    }
    return playbackCtxRef.current;
  };

  const playPcm16Chunk = async (
    pcm16: Int16Array,
    sampleRate = LIVE_SAMPLE_RATE,
  ) => {
    const ctx = await ensurePlaybackCtx();

    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 0x8000;

    const buffer = ctx.createBuffer(1, float32.length, sampleRate);
    buffer.getChannelData(0).set(float32);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);

    const now = ctx.currentTime;
    const startAt = Math.max(now, playheadRef.current);
    src.start(startAt);
    playheadRef.current = startAt + buffer.duration;
  };

  const ensureSession = useCallback(async () => {
    if (sessionRef.current || session) return sessionRef.current ?? session;

    if (!apiKey) {
      setError("Missing API key. Set VITE_GEMINI_API_KEY in .env");
      return null;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const ai = getAi();

      const liveSession = await ai.live.connect({
        model: LIVE_MODEL,
        config: {
          systemInstruction: {
            role: "system",
            parts: [{ text: CLINICAL_SYSTEM_INSTRUCTION }],
          },
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
          },

          onmessage: (evtOrMsg: any) => {
            try {
              let msg: any = evtOrMsg;
              if (evtOrMsg?.data !== undefined) msg = evtOrMsg.data;

              if (typeof msg === "string") {
                const s = msg.trim();
                if (s.startsWith("{") || s.startsWith("[")) msg = JSON.parse(s);
                else return;
              }

              const serverContent = msg?.serverContent;
              if (!serverContent) return;

              // 1) bot audio chunks
              const parts =
                serverContent.modelTurn?.parts ||
                serverContent.model_turn?.parts;
              if (Array.isArray(parts)) {
                for (const p of parts) {
                  const inline = p.inlineData || p.inline_data;
                  if (inline?.data) {
                    const pcm16 = decodeBase64ToInt16(inline.data);
                    botPcm16ChunksRef.current.push(pcm16);
                    void playPcm16Chunk(pcm16, LIVE_SAMPLE_RATE);
                  }
                }
              }

              // 2) bot transcript
              const t = serverContent.outputTranscription?.text;
              if (t) {
                botTranscriptRef.current += t;
                setStreamingText((p) => p + t);
              }

              // 3) turn complete => push bot message (ALWAYS audio+transcript)
              if (
                serverContent.turnComplete ||
                serverContent.generationComplete
              ) {
                if (finalizedTurnRef.current) return;
                finalizedTurnRef.current = true;

                const finalText = (botTranscriptRef.current || "").trim();
                const botChunks = botPcm16ChunksRef.current;

                if (botChunks.length > 0) {
                  const wav = pcm16ToWavBlob(botChunks, LIVE_SAMPLE_RATE);
                  const url = URL.createObjectURL(wav);

                  setMessages((p) => [
                    ...p,
                    {
                      role: "model",
                      audioUrl: url,
                      transcript: finalText || "(no transcript)",
                      text: finalText || "(no transcript)",
                    } as any,
                  ]);
                } else {
                  // If ever no audio returned, still show transcript (audio missing)
                  setMessages((p) => [
                    ...p,
                    {
                      role: "model",
                      transcript: finalText || "(no transcript)",
                      text: finalText || "(no transcript)",
                    } as any,
                  ]);
                }

                botPcm16ChunksRef.current = [];
                botTranscriptRef.current = "";
                setStreamingText("");
              }
            } catch (e) {
              console.error("[Live] onmessage failed:", e);
            }
          },

          onerror: (e: any) => {
            console.error("[Live] error:", e);
            setError("Gemini Live connection error.");
          },

          onclose: () => {
            setIsConnected(false);
            sessionRef.current = null;
            setSession(null);
          },
        },
      });

      sessionRef.current = liveSession;
      setSession(liveSession);
      setIsConnecting(false);
      return liveSession;
    } catch (e) {
      console.error("Failed to connect:", e);
      setError("Failed to connect to Gemini Live. Check API key.");
      setIsConnecting(false);
      return null;
    }
  }, [session]);

  // ✅ Start conversation: bot speaks first (audio+transcript)
  const initialPromptSentRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (initialPromptSentRef.current) return;
      initialPromptSentRef.current = true;

      const s = await ensureSession();
      if (!s || cancelled) return;

      finalizedTurnRef.current = false;
      botTranscriptRef.current = "";
      botPcm16ChunksRef.current = [];
      setStreamingText("");

      try {
        await s.sendRealtimeInput({
          text: "Please greet the patient and start the history intake by asking the first question. Respond with AUDIO.",
        });
      } catch (e) {
        console.error("Initial prompt failed:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ensureSession]);

  // ✅ Mic: stop => create user audio bubble + transcript, then send transcript to live (bot replies in audio)
  const toggleMic = async () => {
    // STOP
    if (isMicOn) {
      try {
        recognitionRef.current?.stop();
      } catch {}
      recognitionRef.current = null;

      // user wav
      const userWav = pcm16ToWavBlob(userPcm16ChunksRef.current, 16000);
      const userUrl = URL.createObjectURL(userWav);

      // push placeholder (we’ll update transcript after STT end)
      setMessages((prev) => [
        ...prev,
        { role: "user", audioUrl: userUrl, transcript: "Processing..." } as any,
      ]);
      userPcm16ChunksRef.current = [];

      // stop capture
      try {
        processorRef.current?.disconnect();
        sourceNodeRef.current?.disconnect();
      } catch {}
      processorRef.current = null;
      sourceNodeRef.current = null;

      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;

      try {
        await captureCtxRef.current?.close();
      } catch {}
      captureCtxRef.current = null;

      setIsMicOn(false);
      return;
    }

    // START
    try {
      await ensurePlaybackCtx().catch(() => undefined);
      const liveSession = sessionRef.current ?? (await ensureSession());
      if (!liveSession) return;

      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        setError("Speech recognition not supported. Use Chrome.");
        return;
      }

      finalizedTurnRef.current = false; // allow next bot finalize
      sttSentRef.current = false;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      // capture wav chunks
      userPcm16ChunksRef.current = [];
      const audioCtx = new (
        window.AudioContext || (window as any).webkitAudioContext
      )({ sampleRate: 16000 });
      captureCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        userPcm16ChunksRef.current.push(pcm16);
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      // speech recognition
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      let finalTranscript = "";

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalTranscript += transcript + " ";
        }
      };

      recognition.onend = async () => {
        if (sttSentRef.current) return;
        sttSentRef.current = true;

        const cleaned = finalTranscript.trim() || "Voice message";

        // update last user bubble transcript
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1] as any;
          if (last?.role === "user" && last.transcript === "Processing...") {
            last.transcript = cleaned;
            last.text = cleaned;
          }
          return updated;
        });

        // send transcript to Gemini Live (bot responds in AUDIO)
        try {
          finalizedTurnRef.current = false;
          botTranscriptRef.current = "";
          botPcm16ChunksRef.current = [];
          setStreamingText("");

          await liveSession.sendRealtimeInput({ text: cleaned });
        } catch (e) {
          console.error("Failed to send transcript:", e);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("[STT] error:", event?.error);
      };

      recognition.start();
      recognitionRef.current = recognition;

      setIsMicOn(true);
    } catch (err: any) {
      console.error("Mic error:", err);
      if (err?.name === "NotAllowedError") setError("Mic permission denied.");
      else if (err?.name === "NotFoundError") setError("No microphone found.");
      else setError("Could not access microphone.");
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      try {
        processorRef.current?.disconnect();
        sourceNodeRef.current?.disconnect();
      } catch {}
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      void captureCtxRef.current?.close().catch(() => undefined);

      try {
        recognitionRef.current?.stop();
      } catch {}

      try {
        sessionRef.current?.close?.();
      } catch {}

      try {
        void playbackCtxRef.current?.close();
      } catch {}
    };
  }, []);

  // profile dropdown
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col h-[100dvh] max-w-10xl mx-auto p-0 sm:p-2 gap-4">
      <header className="shrink-0 sticky top-0 z-20 flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">
            Octa Live (Audio Only)
          </h1>
          <p className="text-xs text-slate-500">
            Audio ↔ Audio only. Transcript shown under each audio bubble.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => void ensureSession()}
            disabled={isConnecting || isConnected}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
              isConnected
                ? "bg-emerald-100 text-emerald-700 border border-emerald-300 cursor-default"
                : "bg-slate-900 text-white hover:bg-slate-800"
            }`}
          >
            {isConnected
              ? "Connected"
              : isConnecting
                ? "Connecting..."
                : "Connect"}
          </button>

          {/* PROFILE ICON */}
          <button
            onClick={() => setOpen((p) => !p)}
            className="bg-teal-400 p-2 rounded-lg focus:outline-none"
          >
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </button>

          {open && (
            <div
              ref={dropdownRef}
              className="absolute right-2 top-14 w-22 bg-white border border-slate-200 rounded-lg shadow-lg p-1"
            >
              <LogoutButton onDone={() => setOpen(false)} />
            </div>
          )}
        </div>
      </header>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      <main className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
            {messages.map((m: any, idx: number) => (
              <LiveChatBubble key={idx} message={m} />
            ))}

            {/* optional: show streaming bot transcript while speaking */}
            {streamingText && (
              <LiveChatBubble
                message={{
                  role: "model",
                  text: streamingText,
                  transcript: streamingText,
                  isStreaming: true,
                }}
              />
            )}
          </div>

          {/* ✅ Only mic input (no text input) */}
          <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMic}
              className={`w-12 h-12 flex items-center justify-center rounded-full border text-sm transition ${
                isMicOn
                  ? "bg-red-500 border-red-500 text-white animate-pulse"
                  : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
              }`}
              aria-label={isMicOn ? "Stop microphone" : "Start microphone"}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 1a3 3 0 00-3 3v6a3 3 0 006 0V4a3 3 0 00-3-3z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 10a7 7 0 01-14 0M12 17v6"
                />
              </svg>
            </button>

            <div className="text-xs text-slate-600">
              {isMicOn ? "Listening… tap to stop" : "Tap mic to speak"}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AudioLiveChat;
