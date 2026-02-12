import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import App from "./App";
import Login from "./pages/Login";
import LiveGeminiChat from "./components/LiveGeminiChat";
import AudioLiveChat from "./components/AudioLiveChat";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Login Page */}
        <Route path="/" element={<Login />} />

        {/* Rheuma Bot Page */}
        <Route path="/rheuma" element={<App />} />

        {/* Gemini Live Multimodal Demo */}
        <Route path="/live" element={<LiveGeminiChat />} />

        {/* Gemini Live Multimodal Demo */}
        <Route path="/live_audio" element={<AudioLiveChat />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
