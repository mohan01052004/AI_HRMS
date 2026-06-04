/**
 * components/ChatBot.jsx — Floating AI HR Assistant with Voice I/O
 * - Text input + mic button (Web Speech API — browser native, no API key needed)
 * - TTS toggle: AI responses read aloud via speechSynthesis
 * - Persistent chat history
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, X, Send, Loader2, Sparkles, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import api from "../api/axios";

const QUICK_PROMPTS = [
  "How do I apply for leave?",
  "What is the attendance policy?",
  "How is my salary calculated?",
  "When is the next review cycle?",
];

// Check browser support
const SpeechRecognitionAPI =
  window.SpeechRecognition || window.webkitSpeechRecognition || null;
const hasSpeechSynthesis = "speechSynthesis" in window;

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "👋 Hi! I'm **Alex**, your AI HR Assistant. I can help you with leave policies, attendance, payroll queries, and more. How can I assist you today?\n\n💡 Tip: Click the 🎤 mic button to speak your question!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Voice input state
  const [listening, setListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const recognitionRef = useRef(null);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── TTS ────────────────────────────────────────────────────────────────────
  const speak = useCallback((text) => {
    if (!hasSpeechSynthesis || !ttsEnabled) return;
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    // Strip markdown
    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/#{1,6}\s/g, "")
      .replace(/• /g, "");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 0.9;
    // Pick a good voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) => v.lang === "en-US" && v.name.includes("Google")
    ) || voices.find((v) => v.lang === "en-US") || voices[0];
    if (preferred) utterance.voice = preferred;
    window.speechSynthesis.speak(utterance);
  }, [ttsEnabled]);

  // ── Speech Recognition (Mic) ───────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!SpeechRecognitionAPI) {
      alert("Speech recognition is not supported in your browser. Please use Chrome or Edge.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      // Auto-send after recognition
      setTimeout(() => sendMessage(transcript), 100);
    };

    recognition.start();
  }, [listening]);

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = async (text) => {
    const userMsg = text || input.trim();
    if (!userMsg || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const history = messages.slice(-10);
      const response = await api.post("/ai/chat", {
        message: userMsg,
        history,
      });
      const aiReply = response.data.response;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: aiReply },
      ]);
      // Speak the response if TTS is enabled
      speak(aiReply);
    } catch {
      const errMsg =
        "AI service is unavailable. Please add your **GROQ_API_KEY** to `backend/.env` — get a free key at https://console.groq.com";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: errMsg },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatMessage = (content) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/\n/g, "<br/>")
      .replace(/^- (.+)/gm, "• $1");
  };

  const handleClose = () => {
    setOpen(false);
    if (listening) recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
  };

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          id="chatbot-toggle"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600
            shadow-lg shadow-violet-500/30 flex items-center justify-center text-white
            hover:scale-110 transition-transform z-50 group"
        >
          <Bot size={24} />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-950 animate-pulse" />
        </button>
      )}

      {/* Chat Window */}
      {open && (
        <div
          className="fixed bottom-6 right-6 w-80 sm:w-96 h-[32rem] bg-slate-900 border border-slate-700
            rounded-2xl shadow-2xl shadow-black/50 flex flex-col z-50 overflow-hidden"
          id="chatbot-window"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-600/20 to-indigo-600/20 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
                <Bot size={16} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Alex — HR Assistant</p>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                  <span className="text-xs text-emerald-400">AI Powered · Online</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {/* TTS Toggle */}
              {hasSpeechSynthesis && (
                <button
                  id="chatbot-tts-toggle"
                  onClick={() => {
                    setTtsEnabled((v) => !v);
                    window.speechSynthesis.cancel();
                  }}
                  title={ttsEnabled ? "Disable voice responses" : "Enable voice responses"}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                    ttsEnabled
                      ? "bg-violet-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {ttsEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                </button>
              )}
              <button
                id="chatbot-close"
                onClick={handleClose}
                className="text-slate-400 hover:text-white transition-colors w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-violet-600 text-white rounded-br-sm"
                      : "bg-slate-800 text-slate-200 rounded-bl-sm border border-slate-700"
                  }`}
                  dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                />
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-800 border border-slate-700 px-3 py-2 rounded-xl rounded-bl-sm flex items-center gap-2">
                  <Loader2 size={14} className="text-violet-400 animate-spin" />
                  <span className="text-xs text-slate-400">Alex is thinking...</span>
                </div>
              </div>
            )}
            {/* Voice listening indicator */}
            {listening && (
              <div className="flex justify-center">
                <div className="bg-rose-500/10 border border-rose-500/30 px-3 py-1.5 rounded-full flex items-center gap-2">
                  <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                  <span className="text-xs text-rose-400 font-medium">Listening... Speak now</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick prompts */}
          {messages.length <= 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="text-xs px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700
                    text-slate-300 hover:border-violet-500 hover:text-violet-400 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-4 py-3 border-t border-slate-700 flex items-end gap-2">
            <textarea
              id="chatbot-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={listening ? "Listening..." : "Ask me anything about HR..."}
              rows={1}
              disabled={listening}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm
                text-white placeholder-slate-500 resize-none focus:outline-none focus:border-violet-500
                transition-colors max-h-24 disabled:opacity-60"
            />
            {/* Mic button */}
            {SpeechRecognitionAPI && (
              <button
                id="chatbot-mic"
                onClick={startListening}
                disabled={loading}
                title={listening ? "Stop listening" : "Speak your question"}
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all disabled:opacity-40 ${
                  listening
                    ? "bg-rose-600 hover:bg-rose-500 text-white animate-pulse"
                    : "bg-slate-700 hover:bg-slate-600 text-slate-300"
                }`}
              >
                {listening ? <MicOff size={15} /> : <Mic size={15} />}
              </button>
            )}
            <button
              id="chatbot-send"
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading || listening}
              className="w-9 h-9 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40
                disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors shrink-0"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
