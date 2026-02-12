import React, { useState, useEffect, useRef } from "react";
import { startChat, parseJsonFromText } from "./services/geminiService";
import { Message, ReportSummary } from "./types";
import ChatBubble from "./components/ChatBubble";
import Report from "./components/Report";
import { SUMMARY_SCHEMA_PROMPT } from "./constants";
import LogoutButton from "./components/LogoutButton";

const App: React.FC = () => {
  // const [messages, setMessages] = useState<Message[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "model",
      text: "Our Agent is starting up. It will take around 30 seconds.",
    },
  ]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatSession, setChatSession] = useState<any>(null);
  const [finalReport, setFinalReport] = useState<ReportSummary | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const recognitionRef = useRef<any>(null);
  9;
  // Initialize chat session
  useEffect(() => {
    const session = startChat();
    setChatSession(session);

    // Get initial greeting
    setIsLoading(true);
    session
      .sendMessage({
        message:
          "Hello. Please start the patient history intake as instructed.",
      })
      .then((res: any) => {
        setMessages([{ role: "model", text: res.text }]);
      })
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!voiceEnabled && "speechSynthesis" in window) {
      window.speechSynthesis.cancel(); // 🔥 HARD STOP
    }
  }, [voiceEnabled]);

  const cleanTextForSpeech = (text: string) => {
    return (
      text
        // Remove markdown bold/italic
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")

        // Remove bullet symbols
        .replace(/•/g, "")
        .replace(/-/g, " ")

        // Remove backticks (code)
        .replace(/`/g, "")

        // Remove extra new lines
        .replace(/\n+/g, ". ")

        // Remove multiple spaces
        .replace(/\s+/g, " ")
        .trim()
    );
  };

  // const speakText = (text: string) => {
  //   if (!voiceEnabled) return;
  //   if (typeof window === "undefined") return;
  //   if (!("speechSynthesis" in window)) return;

  //   try {
  //     window.speechSynthesis.cancel();

  //     const cleanedText = cleanTextForSpeech(text);

  //     // const utterance = new SpeechSynthesisUtterance(text);
  //     const utterance = new SpeechSynthesisUtterance(cleanedText);
  //     utterance.rate = 0.95;
  //     utterance.pitch = 1;
  //     utterance.volume = 1;
  //     window.speechSynthesis.speak(utterance);

  //     const voices = window.speechSynthesis.getVoices();
  //     const preferredVoice = voices.find(
  //       (v) =>
  //         v.name.toLowerCase().includes("female") ||
  //         v.name.toLowerCase().includes("google us english"),
  //     );
  //     if (preferredVoice) utterance.voice = preferredVoice;
  //   } catch (err) {
  //     console.error("Speech synthesis failed:", err);
  //   }
  // };

  const speakText = (text: string) => {
    if (!voiceEnabled) return;
    if (typeof window === "undefined") return;
    if (!("speechSynthesis" in window)) return;

    try {
      const synth = window.speechSynthesis;
      synth.cancel(); // stop previous speech

      const cleanedText = cleanTextForSpeech(text);

      const utterance = new SpeechSynthesisUtterance(cleanedText);

      // 🧠 Voice tuning
      utterance.rate = 0.92; // more natural
      utterance.pitch = 1;
      utterance.volume = 1;

      // 🎤 Select better voice
      const voices = synth.getVoices();
      const preferredVoice =
        voices.find((v) => v.name.includes("Google US English")) ||
        voices.find((v) => v.lang === "en-US") ||
        voices[0];

      if (preferredVoice) utterance.voice = preferredVoice;

      synth.speak(utterance);
    } catch (err) {
      console.error("Speech synthesis failed:", err);
    }
  };

  const sendUserMessage = async (userMessage: string) => {
    if (!userMessage.trim() || !chatSession || isLoading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setIsLoading(true);

    try {
      const response = await chatSession.sendMessage({ message: userMessage });
      const modelText = response.text;

      setMessages((prev) => [...prev, { role: "model", text: modelText }]);
      speakText(modelText);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: "I'm sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    await sendUserMessage(input.trim());
  };

  const toggleListening = () => {
    if (typeof window === "undefined") return;

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error("Error stopping recognition:", err);
      }
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join(" ")
        .trim();

      if (!transcript) {
        alert("No speech detected. Please try again.");
        return;
      }

      setInput(transcript);
      // Send the recognized text just like typed input
      void sendUserMessage(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error || event);
      if (event.error === "not-allowed") {
        alert(
          "Microphone access was denied. Please enable it in your browser settings.",
        );
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      setIsListening(false);
    }
  };
  const authState = JSON.parse(localStorage.getItem("doctat_auth") as string);

  const [loadingSummary, setLoadingSummary] = useState(false);

  const generateSummary = async () => {
    if (!chatSession || isLoading) return;
    setIsLoading(true);
    setLoadingSummary(true);
    try {
      const response = await chatSession.sendMessage({
        message: SUMMARY_SCHEMA_PROMPT,
      });
      const reportData = parseJsonFromText(response.text);
      if (reportData) {
        setFinalReport(reportData);
        // Send email when reportData exists (Netlify Function)
        try {
          const emailRes = await fetch("/.netlify/functions/send-report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              summary: reportData,
              meta: { patientName: authState?.name },
            }),
          });
          const result = await emailRes.json().catch(() => ({}));
          if (!emailRes.ok) {
            console.error("Email failed:", result);
            alert(
              "Summary saved, but email could not be sent. Check Netlify env vars (EMAIL_USER, EMAIL_PASS).",
            );
          }
        } catch (emailErr) {
          console.error("Email request failed:", emailErr);
          alert(
            "Summary saved, but email could not be sent. Run with `netlify dev` for local testing.",
          );
        }
      } else {
        alert(
          "Could not generate a structured summary. Please continue the chat or try again.",
        );
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
      setLoadingSummary(false);
    }
  };

  const resetSession = () => {
    setFinalReport(null);
    setMessages([]);
    const session = startChat();
    setChatSession(session);
    setIsLoading(true);
    session
      .sendMessage({
        message: "Hello. Please start the patient history intake.",
      })
      .then((res: any) => {
        setMessages([{ role: "model", text: res.text }]);
      })
      .finally(() => setIsLoading(false));
  };

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

  return (
    // <div className="flex flex-col h-[100dvh] max-w-10xl mx-auto px-0 py-0 md:px-4 md:py-4">
    <div className="flex flex-col h-[100dvh] max-w-10xl mx-auto md:px-4 md:py-4">
      {/* Header */}
      {/* <header className="sticky top-0 z-20 flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-100"> */}
      <header className="shrink-0 sticky top-0 z-20 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-2">
        <div className="flex items-center space-x-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Octa Bot</h1>
            <p className="text-xs text-slate-500 uppercase font-semibold">
              Octa Clinical Intake
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {!finalReport && (
            <button
              onClick={generateSummary}
              disabled={messages.length < 5 || isLoading}
              className="bg-teal-400 hover:bg-teal-500 disabled:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold transition shadow-sm"
            >
              {loadingSummary ? "Generating summary..." : "Finish & Summarize"}
            </button>
          )}

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

          {/* DROPDOWN */}
          {open && (
            <div className="absolute right-2 top-14 w-22 bg-white border border-slate-200 rounded-lg shadow-lg p-1">
              <LogoutButton onDone={() => setOpen(false)} />
            </div>
          )}
        </div>
      </header>

      {/* Main Area */}
      {/* <main className="h-full flex-1 overflow-hidden relative"> */}
      <main className="flex-1 min-h-0 flex flex-col">
        {finalReport ? (
          <Report summary={finalReport} onReset={resetSession} />
        ) : (
          // <div className="h-full flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex-1 min-h-0 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {/* Messages Area */}
            {/* <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4"> */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-4">
              {messages?.map((msg, idx) => (
                <ChatBubble
                  key={idx}
                  role={msg.role as "user" | "model"}
                  text={msg.text}
                />
              ))}
              {isLoading && (
                <div className="flex justify-start mb-4">
                  <div className="bg-slate-100 rounded-2xl px-4 py-3 flex space-x-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-2 border-t border-slate-100 bg-slate-50">
              {/* <div className="shrink-0 p-2 border-t border-slate-100 bg-slate-50"> */}
              <div className="relative flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`flex items-center justify-center w-10 h-10 rounded-full border text-sm transition ${
                    isListening
                      ? "bg-red-500 border-red-500 text-white animate-pulse"
                      : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
                  }`}
                  aria-label={
                    isListening ? "Stop listening" : "Start voice input"
                  }
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

                <button
                  type="button"
                  onClick={() => setVoiceEnabled((prev) => !prev)}
                  className={`flex items-center justify-center w-10 h-10 rounded-full border text-sm transition ${
                    voiceEnabled
                      ? "bg-teal-100 border-teal-400 text-teal-700"
                      : "bg-white border-slate-300 text-slate-500"
                  }`}
                  aria-label={voiceEnabled ? "Turn voice off" : "Turn voice on"}
                  title={voiceEnabled ? "Voice: ON" : "Voice: OFF"}
                >
                  {voiceEnabled ? (
                    // 🔊 SPEAKER ON
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
                        d="M11 5L6 9H3v6h3l5 4V5z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 9a3 3 0 010 6"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M17.5 7a6 6 0 010 10"
                      />
                    </svg>
                  ) : (
                    // 🔇 SPEAKER OFF
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
                        d="M11 5L6 9H3v6h3l5 4V5z"
                      />
                      <line
                        x1="23"
                        y1="9"
                        x2="17"
                        y2="15"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <line
                        x1="17"
                        y1="9"
                        x2="23"
                        y2="15"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                </button>

                <div className="relative flex-1">
                  {isListening && (
                    <span className="absolute -top-4 left-1 text-[10px] text-red-500 animate-pulse">
                      Listening...
                    </span>
                  )}
                  <input
                    type="text"
                    value={input}
                    name="message"
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="Type your response here or use the microphone..."
                    className="w-full pl-4 pr-24 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-teal-500 hover:bg-teal-600 disabled:bg-teal-200 text-white rounded-lg transition"
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
              <p className="hidden md:block text-[10px] text-slate-400 mt-2 text-center uppercase tracking-widest font-bold">
                Follows Clinical Phase Logic: Screening &rarr; Specialization
                &rarr; Red Flags &rarr; Summary
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer Disclaimer */}
      <footer className="mt-2 text-[10px] text-slate-400 text-center leading-relaxed">
        Octa is an AI assistant tool for gathering history. It does not provide
        medical diagnosis. Always consult with a licensed physician for medical
        advice.
      </footer>
    </div>
  );
};

export default App;
