import React, { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";

type Role = "user" | "model";

export type LiveMessage = {
  role: Role;
  text?: string;
  audioUrl?: string;
  transcript?: string;
  isStreaming?: boolean;
};

interface LiveChatBubbleProps {
  message: LiveMessage;
}

const LiveChatBubble: React.FC<LiveChatBubbleProps> = ({ message }) => {
  const isUser = message.role === "user";
  const isBot = message.role === "model";
  const hasAudio = Boolean(message.audioUrl);

  // ✅ Only collapse transcript by default for patient audio messages
  const shouldCollapseTranscript = useMemo(() => {
    return isUser && hasAudio;
  }, [isUser, hasAudio]);

  const [showTranscript, setShowTranscript] = useState(
    !shouldCollapseTranscript,
  );

  const transcriptText = (message.transcript ?? "").trim();
  const isProcessing = transcriptText.toLowerCase() === "processing...";

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
          isUser
            ? "bg-teal-600 text-white rounded-tr-none"
            : "bg-white border border-slate-200 text-slate-800 rounded-tl-none"
        }`}
      >
        {/* AUDIO bubble */}
        {hasAudio ? (
          <div className="space-y-2 min-w-[210px]">
            <audio
              controls
              src={message.audioUrl}
              className="w-full"
              autoPlay={false}
              playsInline
            />

            {/* ✅ Show/Hide label only for patient audio */}
            {isUser && transcriptText && (
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setShowTranscript((p) => !p)}
                className={`text-xs font-semibold underline underline-offset-2 ${
                  isUser ? "text-white/90" : "text-slate-600"
                } ${isProcessing ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {showTranscript ? "Hide transcript" : "Show transcript"}
              </button>
            )}

            {/* Transcript below audio (only when allowed) */}
            {transcriptText &&
              (!shouldCollapseTranscript || showTranscript) && (
                <div
                  className={`text-xs leading-relaxed ${
                    isUser ? "text-white/90" : "text-slate-600"
                  }`}
                >
                  <span className="font-semibold">
                    {isUser ? "" : "Assistant"} transcript:
                  </span>{" "}
                  {transcriptText}
                </div>
              )}

            {message.isStreaming && (
              <div
                className={`text-xs ${
                  isUser ? "text-white/80" : "text-slate-500"
                }`}
              >
                Speaking…
              </div>
            )}
          </div>
        ) : (
          /* TEXT bubble */
          <div
            className={`text-sm leading-relaxed prose prose-sm max-w-none ${
              isUser ? "prose-invert" : ""
            }`}
          >
            <ReactMarkdown
              components={{
                p: ({ children }) => (
                  <p className="mb-2 last:mb-0">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc ml-4 mb-2">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal ml-4 mb-2">{children}</ol>
                ),
                h1: ({ children }) => (
                  <h1 className="text-lg font-bold mb-1">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-base font-bold mb-1">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-sm font-bold mb-1">{children}</h3>
                ),
                strong: ({ children }) => (
                  <span className="font-bold text-inherit">{children}</span>
                ),
              }}
            >
              {message.text ?? ""}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveChatBubble;
