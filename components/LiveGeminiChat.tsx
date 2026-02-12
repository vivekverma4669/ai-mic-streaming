// import React, { useCallback, useEffect, useRef, useState } from "react";
// import { GoogleGenAI, Modality } from "@google/genai";
// import LiveChatBubble, { LiveMessage } from "./LiveChatBubble";
// import ReportLive from "./ReportLive";
// import { ReportSummary } from "../types";
// import {
//   CLINICAL_SYSTEM_INSTRUCTION,
//   SUMMARY_SCHEMA_PROMPT_LIVE_API,
// } from "../constants";
// import { parseJsonFromText } from "../services/geminiService";
// import LogoutButton from "./LogoutButton";

// type LiveSession = any;

// const apiKey =
//   (import.meta as any)?.env?.VITE_GEMINI_API_KEY ??
//   (process as any)?.env?.API_KEY ??
//   undefined;

// const LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";

// // ✅ Fallback TTS model (audio-only) — used ONLY when Live doesn't return audio.
// const TTS_MODEL = "gemini-2.5-flash-preview-tts";
// const TTS_VOICE = "Kore";

// // ✅ Live playback sample rate (Gemini native-audio commonly returns 24k PCM)
// const LIVE_SAMPLE_RATE = 24000;

// // ✅ We will STREAM MIC to Live as PCM16 @ 16k (safe/common)
// // You can change this to 24000 if you resample properly.
// const MIC_STREAM_SAMPLE_RATE = 16000;

// const LiveGeminiChat: React.FC = () => {
//   const authState = JSON.parse(localStorage.getItem("doctat_auth") as string);

//   const [session, setSession] = useState<LiveSession | null>(null);
//   const [isConnecting, setIsConnecting] = useState(false);
//   const [isConnected, setIsConnected] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   const [messages, setMessages] = useState<LiveMessage[]>([
//     {
//       role: "model",
//       text: `Hi ${authState?.name || "there"}, to get started I need a few details. What is your age and what is your gender?`,
//     },
//   ]);
//   const [streamingText, setStreamingText] = useState("");
//   const [input, setInput] = useState("");
//   const [isLoading, setIsLoading] = useState(false);
//   const [isMicOn, setIsMicOn] = useState(false);

//   // Live session
//   const sessionRef = useRef<LiveSession | null>(null);

//   // Keep one AI client instance for non-live calls (TTS / Summary)
//   const aiRef = useRef<GoogleGenAI | null>(null);

//   // Audio capture nodes (USER)
//   const micStreamRef = useRef<MediaStream | null>(null);
//   const captureCtxRef = useRef<AudioContext | null>(null);
//   const processorRef = useRef<ScriptProcessorNode | null>(null);
//   const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

//   const [isResponding, setIsResponding] = useState(false);
//   const [isTtsFallbacking, setIsTtsFallbacking] = useState(false);

//   // Collect user PCM for showing user wav bubble (USER)
//   const userPcm16ChunksRef = useRef<Int16Array[]>([]);

//   // Collect bot transcript (MODEL)
//   const botTranscriptRef = useRef("");

//   // Collect bot audio PCM (MODEL)
//   const botPcm16ChunksRef = useRef<Int16Array[]>([]);

//   // WebAudio playback for bot chunks
//   const playbackCtxRef = useRef<AudioContext | null>(null);
//   const playheadRef = useRef<number>(0);

//   // ✅ Track whether current model response MUST be audio+transcript (when user spoke)
//   const pendingVoiceTurnRef = useRef<boolean>(false);

//   // ✅ guards to prevent duplicate finalize
//   const finalizedTurnRef = useRef<boolean>(false);

//   const blobToBase64 = (blob: Blob) =>
//     new Promise<string>((resolve, reject) => {
//       const reader = new FileReader();
//       reader.onloadend = () => {
//         const res = String(reader.result || "");
//         // "data:audio/wav;base64,AAAA..."
//         const b64 = res.split(",")[1] || "";
//         resolve(b64);
//       };
//       reader.onerror = reject;
//       reader.readAsDataURL(blob);
//     });

//   async function transcribeUserAudio(API_KEY: string, wavBlob: Blob) {
//     // ✅ pick any TEXT model that supports audio input (try these)
//     const MODEL = "models/gemini-2.5-flash"; // if not available for your key, change to models/gemini-2.0-flash

//     const endpoint = `https://generativelanguage.googleapis.com/v1beta/${MODEL}:generateContent?key=${API_KEY}`;

//     const audioB64 = await blobToBase64(wavBlob);

//     const body = {
//       contents: [
//         {
//           role: "user",
//           parts: [
//             {
//               text: "Transcribe this audio to plain text. Return ONLY the transcript text, no extra words.",
//             },
//             {
//               inline_data: {
//                 mime_type: "audio/wav",
//                 data: audioB64,
//               },
//             },
//           ],
//         },
//       ],
//       generationConfig: {
//         temperature: 0,
//       },
//     };

//     const res = await fetch(endpoint, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(body),
//     });

//     const data = await res.json().catch(() => ({}));

//     if (!res.ok) {
//       throw new Error(
//         data?.error?.message ?? `Transcription failed (${res.status})`,
//       );
//     }

//     const text =
//       data?.candidates?.[0]?.content?.parts?.[0]?.text ??
//       data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ??
//       "";

//     return String(text).trim();
//   }

//   // ---- helpers ----
//   const getAi = () => {
//     if (!aiRef.current) aiRef.current = new GoogleGenAI({ apiKey });
//     return aiRef.current;
//   };

//   const pcm16ToWavBlob = (chunks: Int16Array[], sampleRate: number) => {
//     const totalSamples = chunks.reduce((sum, c) => sum + c.length, 0);
//     const pcm = new Int16Array(totalSamples);
//     let offset = 0;
//     for (const c of chunks) {
//       pcm.set(c, offset);
//       offset += c.length;
//     }

//     const bytesPerSample = 2;
//     const blockAlign = 1 * bytesPerSample;
//     const byteRate = sampleRate * blockAlign;
//     const dataSize = pcm.length * bytesPerSample;

//     const buffer = new ArrayBuffer(44 + dataSize);
//     const view = new DataView(buffer);

//     const writeString = (o: number, s: string) => {
//       for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
//     };

//     writeString(0, "RIFF");
//     view.setUint32(4, 36 + dataSize, true);
//     writeString(8, "WAVE");

//     writeString(12, "fmt ");
//     view.setUint32(16, 16, true);
//     view.setUint16(20, 1, true); // PCM
//     view.setUint16(22, 1, true); // mono
//     view.setUint32(24, sampleRate, true);
//     view.setUint32(28, byteRate, true);
//     view.setUint16(32, blockAlign, true);
//     view.setUint16(34, 16, true); // bits per sample

//     writeString(36, "data");
//     view.setUint32(40, dataSize, true);

//     let pos = 44;
//     for (let i = 0; i < pcm.length; i++, pos += 2) {
//       view.setInt16(pos, pcm[i], true);
//     }

//     return new Blob([buffer], { type: "audio/wav" });
//   };

//   const decodeBase64ToInt16 = (b64: string) => {
//     const bin = atob(b64);
//     const bytes = new Uint8Array(bin.length);
//     for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
//     return new Int16Array(bytes.buffer);
//   };

//   const int16ToBase64 = (pcm16: Int16Array) => {
//     const bytes = new Uint8Array(pcm16.buffer);
//     let binary = "";
//     // chunk to avoid call stack issues
//     const chunkSize = 0x8000;
//     for (let i = 0; i < bytes.length; i += chunkSize) {
//       binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
//     }
//     return btoa(binary);
//   };

//   const ensurePlaybackCtx = async () => {
//     if (!playbackCtxRef.current) {
//       playbackCtxRef.current = new (
//         window.AudioContext || (window as any).webkitAudioContext
//       )({ sampleRate: LIVE_SAMPLE_RATE });
//       playheadRef.current = playbackCtxRef.current.currentTime;
//     }
//     if (playbackCtxRef.current.state === "suspended") {
//       await playbackCtxRef.current.resume();
//     }
//     return playbackCtxRef.current;
//   };

//   const playPcm16Chunk = async (
//     pcm16: Int16Array,
//     sampleRate = LIVE_SAMPLE_RATE,
//   ) => {
//     const ctx = await ensurePlaybackCtx();

//     const float32 = new Float32Array(pcm16.length);
//     for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 0x8000;

//     const buffer = ctx.createBuffer(1, float32.length, sampleRate);
//     buffer.getChannelData(0).set(float32);

//     const src = ctx.createBufferSource();
//     src.buffer = buffer;
//     src.connect(ctx.destination);

//     const now = ctx.currentTime;
//     const startAt = Math.max(now, playheadRef.current);
//     src.start(startAt);

//     playheadRef.current = startAt + buffer.duration;
//   };

//   // ✅ NOTE: TTS fallback is disabled per requirements
//   // All audio responses must come from Live API only
//   // Future: Can be re-enabled if Live API doesn't return audio in edge cases
//   /*
//   const generateTtsAudioUrl = async (text: string) => {
//     const clean = (text || "").trim();
//     if (!clean) return null;
//     if (!apiKey) throw new Error("Missing API key");

//     const ai = getAi();
//     const res = await ai.models.generateContent({
//       model: TTS_MODEL,
//       contents: [{ role: "user", parts: [{ text: clean }] }],
//       config: {
//         responseModalities: ["AUDIO"],
//         speechConfig: {
//           voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE } },
//         },
//       } as any,
//     });

//     const b64 = (res as any)?.candidates?.[0]?.content?.parts?.[0]?.inlineData
//       ?.data;
//     if (!b64) return null;

//     const pcm16 = decodeBase64ToInt16(b64);
//     const wav = pcm16ToWavBlob([pcm16], LIVE_SAMPLE_RATE);
//     return URL.createObjectURL(wav);
//   };
//   */

//   // ---- live session ----
//   const ensureSession = useCallback(async () => {
//     if (sessionRef.current || session) return sessionRef.current ?? session;

//     if (!apiKey) {
//       setError("Missing API key. In Vite set VITE_GEMINI_API_KEY in .env");
//       return null;
//     }

//     setIsConnecting(true);
//     setError(null);

//     try {
//       const ai = getAi();

//       const liveSession = await ai.live.connect({
//         model: LIVE_MODEL,
//         // ✅ IMPORTANT: Config matches official Live API JS example:
//         // https://ai.google.dev/gemini-api/docs/live?example=mic-stream
//         config: {
//           // Docs use a plain string; this keeps us closest to reference behaviour.
//           systemInstruction: CLINICAL_SYSTEM_INSTRUCTION,

//           // CRITICAL: use Modality.AUDIO so the SDK correctly encodes an
//           // audio response modality for every turn.
//           responseModalities: [Modality.AUDIO],
//         } as any,
//         callbacks: {
//           onopen: () => {
//             console.log("[Live] WebSocket opened");
//             setIsConnected(true);
//           },

//           onmessage: (evtOrMsg: any) => {
//             // console.log("Received_message:", evtOrMsg);

//             try {
//               // The JS SDK already gives us a parsed message object that
//               // matches the Live API shape used in the mic-stream example.
//               const msg: any = evtOrMsg;
//               const serverContent = msg?.serverContent;
//               if (!serverContent) return;

//               // Helpful debug (uncomment while testing)
//               // console.log("serverContent keys:", Object.keys(serverContent));
//               // console.log("serverContent:", serverContent);

//               // ✅ 1) BOT AUDIO (PCM16 base64 chunks)
//               const parts =
//                 serverContent.modelTurn?.parts ||
//                 serverContent.model_turn?.parts;

//               if (Array.isArray(parts)) {
//                 for (const p of parts) {
//                   // Audio comes back as inlineData with base64‑encoded PCM16,
//                   // exactly as in the Node mic-stream example.
//                   const inline = p.inlineData || p.inline_data;
//                   if (inline?.data) {
//                     const pcm16 = decodeBase64ToInt16(inline.data);
//                     botPcm16ChunksRef.current.push(pcm16);
//                     void playPcm16Chunk(pcm16, LIVE_SAMPLE_RATE);
//                   }

//                   // If text parts are present, accumulate them as a transcript
//                   // for this turn and show it in the streaming bubble.
//                   if (typeof p.text === "string" && p.text.length > 0) {
//                     botTranscriptRef.current += p.text;
//                     setStreamingText((prev) => prev + p.text);
//                   }
//                 }
//               }

//               // ✅ 3) TURN COMPLETE => create a new bot bubble with audio + transcript
//               if (
//                 serverContent.turnComplete ||
//                 serverContent.generationComplete
//               ) {
//                 if (finalizedTurnRef.current) return;
//                 finalizedTurnRef.current = true;

//                 const finalText = (botTranscriptRef.current || "").trim();
//                 const botChunks = botPcm16ChunksRef.current;

//                 const finalize = async () => {
//                   // New bubble per bot turn
//                   if (botChunks.length > 0) {
//                     const wav = pcm16ToWavBlob(botChunks, LIVE_SAMPLE_RATE);
//                     const url = URL.createObjectURL(wav);

//                     setMessages((p) => [
//                       ...p,
//                       {
//                         role: "model",
//                         text: finalText || "(no transcript)",
//                         transcript: finalText || "(no transcript)",
//                         audioUrl: url,
//                       } as any,
//                     ]);
//                   } else if (finalText) {
//                     setMessages((p) => [
//                       ...p,
//                       {
//                         role: "model",
//                         text: finalText,
//                         transcript: finalText,
//                       } as any,
//                     ]);
//                   }

//                   setIsResponding(false);
//                   setIsTtsFallbacking(false);

//                   // reset turn state
//                   pendingVoiceTurnRef.current = false;
//                   botPcm16ChunksRef.current = [];
//                   botTranscriptRef.current = "";
//                   setStreamingText("");
//                 };

//                 void finalize();
//               }
//             } catch (e) {
//               console.error("[Live] onmessage handler failed:", e);
//             }
//           },

//           onerror: (e: any) => {
//             console.error("[Live] error:", e);
//             setError(
//               "A connection error occurred while talking to Gemini Live.",
//             );
//           },

//           onclose: () => {
//             console.log("[Live] WebSocket closed");
//             setIsConnected(false);
//             sessionRef.current = null;
//             setSession(null);
//           },
//         },
//       });

//       sessionRef.current = liveSession;
//       setSession(liveSession);
//       setIsConnecting(false);
//       return liveSession;
//     } catch (e) {
//       console.error("Failed to connect:", e);
//       setError("Failed to connect to Gemini Live. Check your API key.");
//       setIsConnecting(false);
//       return null;
//     }
//   }, [session]);

//   // ---- send text ----
//   const sendText = async () => {
//     const trimmed = input.trim();
//     if (!trimmed) return;

//     await ensurePlaybackCtx().catch(() => undefined);

//     const liveSession = await ensureSession();
//     if (!liveSession) return;

//     finalizedTurnRef.current = false;
//     // ✅ For text input, bot should send audio+transcript (Live API always requests audio)
//     pendingVoiceTurnRef.current = false;

//     setMessages((p) => [...p, { role: "user", text: trimmed } as any]);
//     setInput("");

//     botTranscriptRef.current = "";
//     botPcm16ChunksRef.current = [];
//     setStreamingText("");

//     setIsResponding(true);

//     try {
//       console.log("[Live] Sending text input:", trimmed);
//       // ✅ Live API config always requests AUDIO, so responses should have audio+transcript
//       await liveSession.sendRealtimeInput({ text: trimmed });
//     } catch (e) {
//       setIsResponding(false);
//       console.error("sendText failed:", e);
//       setError("Failed to send text to Gemini Live.");
//     }
//   };

//   // ---- mic handling: STREAM MIC PCM to LIVE (NO Web Speech STT) ----
//   const startMic = async () => {
//     // STOP MIC
//     if (isMicOn) {
//       console.log("[Live] Stopping microphone");

//       // Stop audio capture
//       try {
//         processorRef.current?.disconnect();
//         sourceNodeRef.current?.disconnect();
//       } catch {}
//       processorRef.current = null;
//       sourceNodeRef.current = null;

//       micStreamRef.current?.getTracks().forEach((t) => t.stop());
//       micStreamRef.current = null;

//       try {
//         await captureCtxRef.current?.close();
//       } catch {}
//       captureCtxRef.current = null;

//       // Show user audio bubble (audio tag)
//       const userWav = pcm16ToWavBlob(
//         userPcm16ChunksRef.current,
//         MIC_STREAM_SAMPLE_RATE,
//       );
//       const userUrl = URL.createObjectURL(userWav);
//       setMessages((prev) => [
//         ...prev,
//         { role: "user", audioUrl: userUrl, transcript: "Voice message" } as any,
//       ]);
//       userPcm16ChunksRef.current = [];

//       // Mark end-of-turn to encourage model to respond
//       // Different SDK versions use different end signals; try the safest:
//       try {
//         const liveSession = sessionRef.current;
//         if (liveSession) {
//           // Some versions accept: { event: { type: "END_OF_TURN" } }
//           await liveSession.sendRealtimeInput({
//             event: { type: "END_OF_TURN" },
//           } as any);
//         }
//       } catch (e) {
//         // If your SDK doesn't support it, it will throw; audio still may work without it.
//         console.warn("[Live] END_OF_TURN not accepted by SDK:", e);
//       }

//       setIsMicOn(false);
//       return;
//     }

//     // START MIC
//     try {
//       console.log("[Live] Starting microphone");

//       await ensurePlaybackCtx().catch(() => undefined);

//       const liveSession = sessionRef.current ?? (await ensureSession());
//       if (!liveSession) return;

//       const stream = await navigator.mediaDevices.getUserMedia({
//         audio: {
//           echoCancellation: true,
//           noiseSuppression: true,
//           autoGainControl: true,
//         } as any,
//       });
//       micStreamRef.current = stream;

//       userPcm16ChunksRef.current = [];
//       botTranscriptRef.current = "";
//       botPcm16ChunksRef.current = [];
//       setStreamingText("");

//       finalizedTurnRef.current = false;

//       // ✅ Voice input => bot response MUST be audio + transcript from Live API
//       // (Live session config always requests AUDIO, transcript will follow)
//       pendingVoiceTurnRef.current = true;

//       // Capture mic at MIC_STREAM_SAMPLE_RATE
//       const audioCtx = new (
//         window.AudioContext || (window as any).webkitAudioContext
//       )({ sampleRate: MIC_STREAM_SAMPLE_RATE });
//       captureCtxRef.current = audioCtx;

//       const source = audioCtx.createMediaStreamSource(stream);
//       sourceNodeRef.current = source;

//       const processor = audioCtx.createScriptProcessor(4096, 1, 1);
//       processorRef.current = processor;

//       // Stream chunks to Live
//       processor.onaudioprocess = (e) => {
//         const inputFloat = e.inputBuffer.getChannelData(0);

//         const pcm16 = new Int16Array(inputFloat.length);
//         for (let i = 0; i < inputFloat.length; i++) {
//           const s = Math.max(-1, Math.min(1, inputFloat[i]));
//           pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
//         }

//         // keep for local user wav
//         userPcm16ChunksRef.current.push(pcm16);

//         // send to live
//         const b64 = int16ToBase64(pcm16);

//         // NOTE: mimeType is important
//         try {
//           liveSession.sendRealtimeInput({
//             audio: {
//               data: b64,
//               mimeType: `audio/pcm;rate=${MIC_STREAM_SAMPLE_RATE}`,
//             },
//           } as any);
//         } catch (err) {
//           console.warn("[Live] send audio chunk failed:", err);
//         }
//       };

//       source.connect(processor);
//       // Connecting to destination is optional; but some browsers require it to run the processor
//       processor.connect(audioCtx.destination);

//       setIsMicOn(true);
//       console.log("[Live] Microphone streaming PCM to Live");
//     } catch (err: any) {
//       console.error("Mic error:", err);
//       if (err?.name === "NotAllowedError") {
//         setError(
//           "Microphone access was denied. Enable it in browser settings.",
//         );
//       } else if (err?.name === "NotFoundError") {
//         setError("No microphone found on this device.");
//       } else {
//         setError("Could not access microphone.");
//       }
//     }
//   };

//   // ---- summary ----
//   const [finalReport, setFinalReport] = useState<ReportSummary | null>(null);

//   const sanitizeForSummary = (t: string) => {
//     const s = (t || "").trim();
//     if (!s) return "";

//     // remove internal/protocol style content
//     const bad = [
//       /phase\s*\d+/i,
//       /per\s+protocol/i,
//       /logic\s+map/i,
//       /i'?m\s+currently\s+stuck/i,
//       /gathering\s+preliminary\s+details/i,
//       /acknowledge\s+and\s+advance/i,
//     ];

//     return s
//       .split("\n")
//       .map((l) => l.trim())
//       .filter((l) => l && !bad.some((re) => re.test(l)))
//       .join("\n");
//   };

//   // Build fullTranscript as Q/A pairs (Assistant->q, Patient->a)

//   const buildQAForSummary = () => {
//     const qa: Array<{ q: string; a: string }> = [];
//     let lastQ: string | null = null;

//     for (const m of messages as any[]) {
//       const txt = sanitizeForSummary(m.text ?? m.transcript ?? "");
//       if (!txt) continue;

//       if (m.role === "model") {
//         lastQ = txt;
//       } else if (m.role === "user") {
//         if (lastQ) {
//           qa.push({ q: lastQ, a: txt });
//           lastQ = null;
//         }
//       }
//     }

//     return qa;
//   };

//   const buildTranscriptForSummary = () => {
//     const qa = buildQAForSummary();

//     // If no QA available (edge), fallback to plain transcript
//     if (!qa.length) {
//       return messages
//         .filter((m: any) => m.role === "user" || m.role === "model")
//         .map((m: any) => {
//           const who = m.role === "user" ? "Patient" : "Assistant";
//           const txt = sanitizeForSummary(m.text ?? m.transcript ?? "");
//           return `${who}: ${txt}`;
//         })
//         .join("\n");
//     }

//     // Prefer Q/A format (cleaner)
//     return qa
//       .map((x, i) => `Q${i + 1}: ${x.q}\nA${i + 1}: ${x.a}`)
//       .join("\n\n");
//   };

//   async function generateSummaryAPI(API_KEY: string, transcriptText: string) {
//     // ✅ Use gemini-3-pro-preview for summary
//     const MODEL = "models/gemini-3-pro-preview";

//     // ✅ v1beta endpoint
//     const endpoint = `https://generativelanguage.googleapis.com/v1beta/${MODEL}:generateContent?key=${API_KEY}`;

//     const body = {
//       contents: [
//         {
//           role: "user",
//           parts: [
//             {
//               text:
//                 `${SUMMARY_SCHEMA_PROMPT_LIVE_API}\n\n` +
//                 `Return ONLY raw JSON. No markdown. No backticks.\n` +
//                 `If not mentioned: use "Not reported" for strings and [] for arrays.\n\n` +
//                 `Conversation:\n${transcriptText}`,
//             },
//           ],
//         },
//       ],
//       generationConfig: {
//         responseMimeType: "application/json",
//         temperature: 0.2,
//       },
//     };

//     const res = await fetch(endpoint, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(body),
//     });

//     const data = await res.json().catch(() => ({}));

//     if (!res.ok) {
//       throw new Error(
//         data?.error?.message ?? `Gemini summary failed (${res.status})`,
//       );
//     }

//     const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

//     try {
//       return JSON.parse(raw);
//     } catch {
//       const parsed = parseJsonFromText(raw);
//       if (parsed) return parsed;
//       throw new Error("Summary response was not valid JSON: " + raw);
//     }
//   }

//   const generateSummary = async () => {
//     if (!apiKey) {
//       setError("Missing API key. Set VITE_GEMINI_API_KEY in .env");
//       return;
//     }
//     if (isLoading) return;

//     setIsLoading(true);
//     setError(null);

//     try {
//       const transcriptText = buildTranscriptForSummary();

//       const reportData = (await generateSummaryAPI(
//         apiKey as string,
//         transcriptText,
//       )) as ReportSummary;

//       // Ensure fullTranscript is present (in case model skips it)
//       if (!reportData?.fullTranscript?.length) {
//         reportData.fullTranscript = buildQAForSummary();
//       }

//       setFinalReport(reportData);

//       // Optional email
//       try {
//         const emailRes = await fetch("/.netlify/functions/send-report", {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ summary: reportData }),
//         });
//         const result = await emailRes.json().catch(() => ({}));
//         if (!emailRes.ok) console.error("Email failed:", result);
//       } catch (emailErr) {
//         console.error("Email request failed:", emailErr);
//       }
//     } catch (err: any) {
//       console.error("Summary error:", err);
//       setError(err?.message ?? "Failed to generate summary.");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   // const resetSession = () => {
//   //   setFinalReport(null);
//   //   setMessages([]);
//   //   setStreamingText("");
//   // };

//   const resetSession = () => {
//     setFinalReport(null);
//     setMessages([
//       {
//         role: "model",
//         text: `Hi ${authState?.name || "there"}, to get started I need a few details. What is your age and what is your gender?`,
//       },
//     ]);
//     setStreamingText("");
//     setError(null);
//   };

//   // NOTE: We intentionally do NOT auto-send a speaking prompt on load.
//   // The assistant will start speaking only after the first user input
//   // (text or voice) to avoid overlapping or repeating audio.

//   // Cleanup
//   useEffect(() => {
//     return () => {
//       try {
//         processorRef.current?.disconnect();
//         sourceNodeRef.current?.disconnect();
//       } catch {}
//       micStreamRef.current?.getTracks().forEach((t) => t.stop());
//       void captureCtxRef.current?.close().catch(() => undefined);

//       if (sessionRef.current?.close) {
//         try {
//           sessionRef.current.close();
//         } catch {}
//       }

//       if (playbackCtxRef.current) {
//         try {
//           void playbackCtxRef.current.close();
//         } catch {}
//       }
//     };
//   }, []);

//   const [open, setOpen] = useState(false);
//   const dropdownRef = useRef<HTMLDivElement>(null);

//   // ✅ close dropdown on outside click
//   useEffect(() => {
//     const handleClickOutside = (e: MouseEvent) => {
//       if (
//         dropdownRef.current &&
//         !dropdownRef.current.contains(e.target as Node)
//       ) {
//         setOpen(false);
//       }
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   const canSummarize =
//     !isLoading &&
//     messages.some((m: any) => m.role === "user") &&
//     messages.some((m: any) => m.role === "model");

//   return (
//     <div className="flex flex-col h-[100dvh] max-w-10xl mx-auto p-0 sm:p-2 gap-4">
//       <header className="shrink-0 sticky top-0 z-20 flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-slate-200">
//         <div>
//           <h1 className="text-lg font-semibold text-slate-800">Octa Live</h1>
//           <p className="text-xs text-slate-500">
//             Octa Clinical Intake with live audio + chat.
//           </p>
//         </div>

//         <div className="flex items-center gap-4">
//           {!finalReport && (
//             <button
//               onClick={generateSummary}
//               disabled={!canSummarize}
//               className="bg-teal-400 hover:bg-teal-500 disabled:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold transition shadow-sm"
//             >
//               Finish & Summarize
//             </button>
//           )}

//           <button
//             onClick={() => setOpen((p) => !p)}
//             className="bg-teal-400 p-2 rounded-lg focus:outline-none"
//           >
//             <svg
//               className="w-6 h-6 text-white"
//               fill="none"
//               stroke="currentColor"
//               viewBox="0 0 24 24"
//             >
//               <path
//                 strokeLinecap="round"
//                 strokeLinejoin="round"
//                 strokeWidth="2"
//                 d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
//               />
//             </svg>
//           </button>

//           {open && (
//             <div className="absolute right-2 top-14 w-22 bg-white border border-slate-200 rounded-lg shadow-lg p-1">
//               <LogoutButton onDone={() => setOpen(false)} />
//             </div>
//           )}
//         </div>
//       </header>

//       {error && (
//         <div className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
//           {error}
//         </div>
//       )}

//       <main className="flex-1 min-h-0 flex flex-col">
//         {finalReport ? (
//           <ReportLive summary={finalReport} onReset={resetSession} />
//         ) : (
//           <div className="flex-1 min-h-0 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
//             <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
//               {messages.map((m: any, idx: number) => (
//                 <LiveChatBubble key={idx} message={m} />
//               ))}

//               {streamingText && (
//                 <LiveChatBubble
//                   message={{
//                     role: "model",
//                     text: streamingText,
//                     isStreaming: true,
//                   }}
//                 />
//               )}

//               {isLoading && (
//                 <div className="flex justify-start mb-4">
//                   <div className="bg-slate-100 rounded-2xl px-4 py-3 flex space-x-1">
//                     <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
//                     <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
//                     <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
//                   </div>
//                 </div>
//               )}
//             </div>

//             <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center gap-2">
//               <button
//                 type="button"
//                 onClick={startMic}
//                 disabled={isResponding || isTtsFallbacking}
//                 className={`w-10 h-10 flex items-center justify-center rounded-full border text-sm transition ${
//                   isMicOn
//                     ? "bg-red-500 border-red-500 text-white animate-pulse"
//                     : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
//                 }`}
//                 aria-label={isMicOn ? "Stop microphone" : "Start microphone"}
//               >
//                 <svg
//                   className="w-5 h-5"
//                   fill="none"
//                   stroke="currentColor"
//                   viewBox="0 0 24 24"
//                 >
//                   <path
//                     strokeLinecap="round"
//                     strokeLinejoin="round"
//                     strokeWidth="2"
//                     d="M12 1a3 3 0 00-3 3v6a3 3 0 006 0V4a3 3 0 00-3-3z"
//                   />
//                   <path
//                     strokeLinecap="round"
//                     strokeLinejoin="round"
//                     strokeWidth="2"
//                     d="M19 10a7 7 0 01-14 0M12 17v6"
//                   />
//                 </svg>
//               </button>

//               <div className="flex-1 relative">
//                 <input
//                   type="text"
//                   value={input}
//                   onChange={(e) => setInput(e.target.value)}
//                   onKeyDown={(e) => {
//                     if (e.key === "Enter") {
//                       e.preventDefault();
//                       void sendText();
//                     }
//                   }}
//                   placeholder="Type your response here or use the microphone..."
//                   className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
//                 />

//                 <button
//                   type="button"
//                   onClick={() => void sendText()}
//                   disabled={!input.trim() || isResponding || isTtsFallbacking}
//                   className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-1 rounded-lg text-xs font-medium bg-teal-600 text-white disabled:bg-teal-200"
//                 >
//                   <svg
//                     className="w-6 h-6"
//                     fill="none"
//                     stroke="currentColor"
//                     viewBox="0 0 24 24"
//                   >
//                     <path
//                       strokeLinecap="round"
//                       strokeLinejoin="round"
//                       strokeWidth="2"
//                       d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
//                     ></path>
//                   </svg>
//                 </button>
//               </div>
//             </div>
//           </div>
//         )}
//       </main>
//     </div>
//   );
// };

// export default LiveGeminiChat;

import React, { useCallback, useEffect, useRef, useState } from "react";
import { GoogleGenAI, Modality } from "@google/genai";
import LiveChatBubble, { LiveMessage } from "./LiveChatBubble";
import ReportLive from "./ReportLive";
import { ReportSummary } from "../types";
import {
  CLINICAL_SYSTEM_INSTRUCTION,
  SUMMARY_SCHEMA_PROMPT_LIVE_API,
} from "../constants";
import { parseJsonFromText } from "../services/geminiService";
import LogoutButton from "./LogoutButton";

type LiveSession = any;

const apiKey =
  (import.meta as any)?.env?.VITE_GEMINI_API_KEY ??
  (process as any)?.env?.API_KEY ??
  undefined;

const LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";

// ✅ Fallback TTS model (audio-only) — used ONLY when Live doesn't return audio.
const TTS_MODEL = "gemini-2.5-flash-preview-tts";
const TTS_VOICE = "Kore";

// ✅ Live playback sample rate (Gemini native-audio commonly returns 24k PCM)
const LIVE_SAMPLE_RATE = 24000;

// ✅ We will STREAM MIC to Live as PCM16 @ 16k (safe/common)
// You can change this to 24000 if you resample properly.
const MIC_STREAM_SAMPLE_RATE = 16000;

const LiveGeminiChat: React.FC = () => {
  const authState = JSON.parse(localStorage.getItem("doctat_auth") as string);

  const [session, setSession] = useState<LiveSession | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [messages, setMessages] = useState<LiveMessage[]>([
    {
      role: "model",
      text: `Hi ${authState?.name || "there"}, to get started I need a few details. What is your age and what is your gender?`,
    },
  ]);
  const [streamingText, setStreamingText] = useState("");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);

  // Live session
  const sessionRef = useRef<LiveSession | null>(null);

  // Keep one AI client instance for non-live calls (TTS / Summary)
  const aiRef = useRef<GoogleGenAI | null>(null);

  // Audio capture nodes (USER)
  const micStreamRef = useRef<MediaStream | null>(null);
  const captureCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const [isResponding, setIsResponding] = useState(false);
  const [isTtsFallbacking, setIsTtsFallbacking] = useState(false);

  // Collect user PCM for showing user wav bubble (USER)
  const userPcm16ChunksRef = useRef<Int16Array[]>([]);

  // Collect bot transcript (MODEL)
  const botTranscriptRef = useRef("");

  // Collect bot audio PCM (MODEL)
  const botPcm16ChunksRef = useRef<Int16Array[]>([]);

  // WebAudio playback for bot chunks
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const playheadRef = useRef<number>(0);

  // ✅ Track whether current model response MUST be audio+transcript (when user spoke)
  const pendingVoiceTurnRef = useRef<boolean>(false);

  // ✅ guards to prevent duplicate finalize
  const finalizedTurnRef = useRef<boolean>(false);

  const blobToBase64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = String(reader.result || "");
        // "data:audio/wav;base64,AAAA..."
        const b64 = res.split(",")[1] || "";
        resolve(b64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const [loadingTts, setLoadingTts] = useState(false);

  async function transcribeUserAudio(API_KEY: string, wavBlob: Blob) {
    setLoadingTts(true);
    // ✅ pick any TEXT model that supports audio input (try these)
    const MODEL = "models/gemini-2.5-flash"; // if not available for your key, change to models/gemini-2.0-flash

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/${MODEL}:generateContent?key=${API_KEY}`;

    const audioB64 = await blobToBase64(wavBlob);

    const body = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: "Transcribe this audio to plain text. Return ONLY the transcript text, no extra words.",
            },
            {
              inline_data: {
                mime_type: "audio/wav",
                data: audioB64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
      },
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(
        data?.error?.message ?? `Transcription failed (${res.status})`,
      );
      setLoadingTts(false);
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ??
      "";

    setLoadingTts(false);

    return String(text).trim();
  }

  // ---- helpers ----
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
    view.setUint16(34, 16, true); // bits per sample

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

  const int16ToBase64 = (pcm16: Int16Array) => {
    const bytes = new Uint8Array(pcm16.buffer);
    let binary = "";
    // chunk to avoid call stack issues
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
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

  // ---- live session ----
  const ensureSession = useCallback(async () => {
    if (sessionRef.current || session) return sessionRef.current ?? session;

    if (!apiKey) {
      setError("Missing API key. In Vite set VITE_GEMINI_API_KEY in .env");
      return null;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const ai = getAi();

      const liveSession = await ai.live.connect({
        model: LIVE_MODEL,
        config: {
          systemInstruction: CLINICAL_SYSTEM_INSTRUCTION,
          responseModalities: [Modality.AUDIO],
        } as any,
        callbacks: {
          onopen: () => {
            console.log("[Live] WebSocket opened");
            setIsConnected(true);
          },

          onmessage: (evtOrMsg: any) => {
            try {
              const msg: any = evtOrMsg;
              const serverContent = msg?.serverContent;
              if (!serverContent) return;

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

                  if (typeof p.text === "string" && p.text.length > 0) {
                    botTranscriptRef.current += p.text;
                    setStreamingText((prev) => prev + p.text);
                  }
                }
              }

              if (
                serverContent.turnComplete ||
                serverContent.generationComplete
              ) {
                if (finalizedTurnRef.current) return;
                finalizedTurnRef.current = true;

                const finalText = (botTranscriptRef.current || "").trim();
                const botChunks = botPcm16ChunksRef.current;

                const finalize = async () => {
                  if (botChunks.length > 0) {
                    const wav = pcm16ToWavBlob(botChunks, LIVE_SAMPLE_RATE);
                    const url = URL.createObjectURL(wav);

                    setMessages((p) => [
                      ...p,
                      {
                        role: "model",
                        text: finalText || "(no transcript)",
                        transcript: finalText || "(no transcript)",
                        audioUrl: url,
                      } as any,
                    ]);
                  } else if (finalText) {
                    setMessages((p) => [
                      ...p,
                      {
                        role: "model",
                        text: finalText,
                        transcript: finalText,
                      } as any,
                    ]);
                  }

                  setIsResponding(false);
                  setIsTtsFallbacking(false);

                  pendingVoiceTurnRef.current = false;
                  botPcm16ChunksRef.current = [];
                  botTranscriptRef.current = "";
                  setStreamingText("");
                };

                void finalize();
              }
            } catch (e) {
              console.error("[Live] onmessage handler failed:", e);
            }
          },

          onerror: (e: any) => {
            console.error("[Live] error:", e);
            setError(
              "A connection error occurred while talking to Gemini Live.",
            );
          },

          onclose: () => {
            console.log("[Live] WebSocket closed");
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
      setError("Failed to connect to Gemini Live. Check your API key.");
      setIsConnecting(false);
      return null;
    }
  }, [session]);

  // ---- send text ----
  const sendText = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    await ensurePlaybackCtx().catch(() => undefined);

    const liveSession = await ensureSession();
    if (!liveSession) return;

    finalizedTurnRef.current = false;
    pendingVoiceTurnRef.current = false;

    setMessages((p) => [...p, { role: "user", text: trimmed } as any]);
    setInput("");

    botTranscriptRef.current = "";
    botPcm16ChunksRef.current = [];
    setStreamingText("");

    setIsResponding(true);

    try {
      console.log("[Live] Sending text input:", trimmed);
      await liveSession.sendRealtimeInput({ text: trimmed });
    } catch (e) {
      setIsResponding(false);
      console.error("sendText failed:", e);
      setError("Failed to send text to Gemini Live.");
    }
  };

  // ---- mic handling: STREAM MIC PCM to LIVE (NO Web Speech STT) ----
  const startMic = async () => {
    // STOP MIC
    if (isMicOn) {
      console.log("[Live] Stopping microphone");

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

      // Show user audio bubble (audio tag) + transcribe => summary gets real patient answers
      const userWav = pcm16ToWavBlob(
        userPcm16ChunksRef.current,
        MIC_STREAM_SAMPLE_RATE,
      );
      const userUrl = URL.createObjectURL(userWav);
      const msgId = Math.random().toString(36).slice(2);

      setMessages((prev: any) => [
        ...prev,
        {
          id: msgId,
          role: "user",
          audioUrl: userUrl,
          transcript: "Transcribing...",
        } as any,
      ]);
      userPcm16ChunksRef.current = [];

      try {
        if (apiKey) {
          const text = await transcribeUserAudio(apiKey as string, userWav);
          setMessages((prev: any) =>
            prev.map((m: any) =>
              m.id === msgId ? { ...m, transcript: text, text } : m,
            ),
          );
        } else {
          setMessages((prev: any) =>
            prev.map((m: any) =>
              m.id === msgId
                ? { ...m, transcript: "Voice message (no API key)" }
                : m,
            ),
          );
        }
      } catch (e) {
        setMessages((prev: any) =>
          prev.map((m: any) =>
            m.id === msgId
              ? { ...m, transcript: "Voice message (transcription failed)" }
              : m,
          ),
        );
      }

      try {
        const liveSession = sessionRef.current;
        if (liveSession) {
          await liveSession.sendRealtimeInput({
            event: { type: "END_OF_TURN" },
          } as any);
        }
      } catch (e) {
        console.warn("[Live] END_OF_TURN not accepted by SDK:", e);
      }

      setIsMicOn(false);
      return;
    }

    // START MIC
    try {
      console.log("[Live] Starting microphone");

      await ensurePlaybackCtx().catch(() => undefined);

      const liveSession = sessionRef.current ?? (await ensureSession());
      if (!liveSession) return;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } as any,
      });
      micStreamRef.current = stream;

      userPcm16ChunksRef.current = [];
      botTranscriptRef.current = "";
      botPcm16ChunksRef.current = [];
      setStreamingText("");

      finalizedTurnRef.current = false;
      pendingVoiceTurnRef.current = true;

      const audioCtx = new (
        window.AudioContext || (window as any).webkitAudioContext
      )({ sampleRate: MIC_STREAM_SAMPLE_RATE });
      captureCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputFloat = e.inputBuffer.getChannelData(0);

        const pcm16 = new Int16Array(inputFloat.length);
        for (let i = 0; i < inputFloat.length; i++) {
          const s = Math.max(-1, Math.min(1, inputFloat[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        userPcm16ChunksRef.current.push(pcm16);

        const b64 = int16ToBase64(pcm16);

        try {
          liveSession.sendRealtimeInput({
            audio: {
              data: b64,
              mimeType: `audio/pcm;rate=${MIC_STREAM_SAMPLE_RATE}`,
            },
          } as any);
        } catch (err) {
          console.warn("[Live] send audio chunk failed:", err);
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      setIsMicOn(true);
      console.log("[Live] Microphone streaming PCM to Live");
    } catch (err: any) {
      console.error("Mic error:", err);
      if (err?.name === "NotAllowedError") {
        setError(
          "Microphone access was denied. Enable it in browser settings.",
        );
      } else if (err?.name === "NotFoundError") {
        setError("No microphone found on this device.");
      } else {
        setError("Could not access microphone.");
      }
    }
  };

  // ---- summary ----
  const [finalReport, setFinalReport] = useState<ReportSummary | null>(null);

  // ✅ SUMMARY ONLY: NEW builders (no Q/A), includes phaseDetails & clean transcript
  const sanitizeTranscriptLine = (t: string) => {
    const s = (t || "").trim();
    if (!s) return "";

    const bad = [
      /per\s+protocol/i,
      /logic\s+map/i,
      /i'?m\s+currently\s+stuck/i,
      /acknowledge\s+and\s+advance/i,
    ];

    return bad.some((re) => re.test(s)) ? "" : s;
  };

  const buildTurnsForSummary = () => {
    return (messages as any[])
      .map((m) => {
        const text = sanitizeTranscriptLine(m.transcript ?? m.text ?? "");
        if (!text) return null;

        return {
          role: m.role === "user" ? "patient" : "assistant",
          text,
        };
      })
      .filter(Boolean) as Array<{
      role: "patient" | "assistant";
      text: string;
    }>;
  };

  const extractPhaseDetails = (
    turns: Array<{ role: "patient" | "assistant"; text: string }>,
  ) => {
    const PHASE_RE =
      /(Initiating\s+Basic\s+Phase|Initiating\s+the\s+Grand\s+Split|Phase\s*\d+|Basic\s+Phase|Grand\s+Split)/i;

    const phaseDetails: Array<{ phase: string; keyFindings: string[] }> = [];
    let current: { phase: string; keyFindings: string[] } | null = null;

    for (const t of turns) {
      if (t.role !== "assistant") continue;

      if (PHASE_RE.test(t.text)) {
        const phaseName = t.text.match(PHASE_RE)?.[0] ?? "Unknown phase";
        current = { phase: phaseName, keyFindings: [] };
        phaseDetails.push(current);
        continue;
      }

      if (current) {
        current.keyFindings.push(t.text);
        if (current.keyFindings.length > 12) current.keyFindings.length = 12;
      }
    }

    return phaseDetails;
  };

  const buildSummaryPayloadText = () => {
    const turns = buildTurnsForSummary();
    const phaseDetails = extractPhaseDetails(turns);

    return JSON.stringify(
      {
        turns,
        phaseDetails,
      },
      null,
      2,
    );
  };

  async function generateSummaryAPI(API_KEY: string, transcriptText: string) {
    const MODEL = "models/gemini-3-pro-preview";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/${MODEL}:generateContent?key=${API_KEY}`;

    const body = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                `${SUMMARY_SCHEMA_PROMPT_LIVE_API}\n\n` +
                `Return ONLY raw JSON. No markdown. No backticks.\n` +
                `If not mentioned: use "Not reported" for strings and [] for arrays.\n\n` +
                `Input JSON:\n${transcriptText}`,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(
        data?.error?.message ?? `Gemini summary failed (${res.status})`,
      );
    }

    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    try {
      return JSON.parse(raw);
    } catch {
      const parsed = parseJsonFromText(raw);
      if (parsed) return parsed;
      throw new Error("Summary response was not valid JSON: " + raw);
    }
  }

  const [loadingSummary, setLoadingSummary] = useState(false);
  const generateSummary = async () => {
    if (!apiKey) {
      setError("Missing API key. Set VITE_GEMINI_API_KEY in .env");
      return;
    }
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    setLoadingSummary(true);
    try {
      // ✅ summary input (turns + phaseDetails)
      const transcriptText = buildSummaryPayloadText();

      const reportData = (await generateSummaryAPI(
        apiKey as string,
        transcriptText,
      )) as ReportSummary;

      // ✅ Ensure fullTranscript exists (as turns, not QA)
      if (!reportData?.fullTranscript?.length) {
        reportData.fullTranscript = buildTurnsForSummary() as any;
      }

      setFinalReport(reportData);

      // Optional email
      try {
        const emailRes = await fetch("/.netlify/functions/send-report-live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            summary: reportData,
            meta: { patientName: authState?.name },
          }),
        });
        const result = await emailRes.json().catch(() => ({}));
        if (!emailRes.ok) console.error("Email failed:", result);
      } catch (emailErr) {
        console.error("Email request failed:", emailErr);
      }
    } catch (err: any) {
      console.error("Summary error:", err);
      setError(err?.message ?? "Failed to generate summary.");
    } finally {
      setIsLoading(false);
      setLoadingSummary(false);
    }
  };

  const resetSession = () => {
    setFinalReport(null);
    setMessages([
      {
        role: "model",
        text: `Hi ${authState?.name || "there"}, to get started I need a few details. What is your age and what is your gender?`,
      },
    ]);
    setStreamingText("");
    setError(null);
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

      if (sessionRef.current?.close) {
        try {
          sessionRef.current.close();
        } catch {}
      }

      if (playbackCtxRef.current) {
        try {
          void playbackCtxRef.current.close();
        } catch {}
      }
    };
  }, []);

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ✅ close dropdown on outside click
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

  const canSummarize =
    !isLoading &&
    messages.some((m: any) => m.role === "user") &&
    messages.some((m: any) => m.role === "model");

  return (
    <div className="flex flex-col h-[100dvh] max-w-10xl mx-auto p-0 sm:p-2 gap-4">
      <header className="shrink-0 sticky top-0 z-20 flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Octa Live</h1>
          <p className="text-xs text-slate-500">
            Octa Clinical Intake with live audio + chat.
          </p>
        </div>

        <div className="flex items-center gap-4">
          {!finalReport && (
            <button
              onClick={generateSummary}
              disabled={!canSummarize || loadingTts}
              className="bg-teal-400 hover:bg-teal-500 disabled:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold transition shadow-sm"
            >
              {loadingSummary ? "Generating summary." : "Finish & Summarize"}
            </button>
          )}

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
            <div className="absolute right-2 top-14 w-22 bg-white border border-slate-200 rounded-lg shadow-lg p-1">
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
        {finalReport ? (
          <ReportLive summary={finalReport} onReset={resetSession} />
        ) : (
          <div className="flex-1 min-h-0 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
              {messages.map((m: any, idx: number) => (
                <LiveChatBubble key={idx} message={m} />
              ))}

              {streamingText && (
                <LiveChatBubble
                  message={{
                    role: "model",
                    text: streamingText,
                    isStreaming: true,
                  }}
                />
              )}

              {isLoading && (
                <div className="flex justify-start mb-4">
                  <div className="bg-slate-100 rounded-2xl px-4 py-3 flex space-x-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center gap-2">
              <button
                type="button"
                onClick={startMic}
                disabled={isResponding || isTtsFallbacking}
                className={`w-10 h-10 flex items-center justify-center rounded-full border text-sm transition ${
                  isMicOn
                    ? "bg-red-500 border-red-500 text-white animate-pulse"
                    : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
                }`}
                aria-label={isMicOn ? "Stop microphone" : "Start microphone"}
              >
                <svg
                  className="w-5 h-5"
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

              <div className="flex-1 relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void sendText();
                    }
                  }}
                  placeholder="Type your response here or use the microphone..."
                  className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />

                <button
                  type="button"
                  onClick={() => void sendText()}
                  disabled={!input.trim() || isResponding || isTtsFallbacking}
                  className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-1 rounded-lg text-xs font-medium bg-teal-600 text-white disabled:bg-teal-200"
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
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    ></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default LiveGeminiChat;
