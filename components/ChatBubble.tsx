import React from "react";
import ReactMarkdown from "react-markdown";

interface ChatBubbleProps {
  role: "user" | "model";
  text: string;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ role, text }) => {
  const isUser = role === "user";

  return (
    <div
      className={`flex w-full mb-4 ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
          isUser
            ? "bg-teal-600 text-white rounded-tr-none"
            : "bg-white border border-slate-200 text-slate-800 rounded-tl-none"
        }`}
      >
        <div
          className={`text-sm leading-relaxed prose prose-sm max-w-none ${isUser ? "prose-invert" : ""}`}
        >
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
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
            {text}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

export default ChatBubble;
