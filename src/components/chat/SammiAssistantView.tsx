import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Bot,
  User,
  Send,
  RotateCcw,
  Copy,
  Check,
  ShieldCheck,
  Cpu,
} from 'lucide-react';
import { api } from '../../services/api.ts';

export interface ChatMessageItem {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  modelUsed?: string;
}

interface SammiAssistantViewProps {
  storeName: string;
  currentUser?: any;
  companySettings?: any;
  onNavigateTab?: (tab: string) => void;
}

export const SammiAssistantView: React.FC<SammiAssistantViewProps> = ({
  storeName,
}) => {
  const [messages, setMessages] = useState<ChatMessageItem[]>(() => {
    try {
      const stored = localStorage.getItem('sammi_chat_history');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return [
      {
        id: 'init-1',
        role: 'model',
        text: `**Salam! Main Sammi hoon — ${storeName} POS System ki AI Assistant.**\n\nAap mujhse counter billing, inventory, sales calculations, stock analysis, ya kisi bhi software aur store operation ke mutaliq sawal pooch sakte hain. Main aapki kya madad karoon?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: 'gemini-3.5-flash',
      },
    ];
  });

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [modelMode, setModelMode] = useState<'fast' | 'general' | 'complex'>('general');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Persist history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('sammi_chat_history', JSON.stringify(messages.slice(-30)));
    } catch {}
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessageItem = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInputMessage('');
    setIsLoading(true);

    try {
      let targetModel = 'gemini-3.8-flash';
      if (modelMode === 'fast') {
        targetModel = 'gemini-3.1-flash-lite';
      } else if (modelMode === 'complex') {
        targetModel = 'gemini-3.1-pro-preview';
      } else {
        targetModel = 'gemini-3.8-flash';
      }

      const payloadMessages = nextHistory
        .filter((m) => m.id !== 'init-1')
        .slice(-10)
        .map((m) => ({
          role: m.role,
          text: m.text,
        }));

      if (payloadMessages.length === 0) {
        payloadMessages.push({ role: 'user', text: query });
      }

      const res = await api.chat.send({
        messages: payloadMessages,
        model: targetModel,
        storeName,
      });

      const modelReply: ChatMessageItem = {
        id: `model-${Date.now()}`,
        role: 'model',
        text: res.reply || `Sammi is ready to help at ${storeName}.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: res.modelUsed || targetModel,
      };

      setMessages((prev) => [...prev, modelReply]);
    } catch (err: any) {
      const errorReply: ChatMessageItem = {
        id: `err-${Date.now()}`,
        role: 'model',
        text: `**Notice:** AI service se rabta nahi ho saka (${err?.message || 'Error'}). Baraye meharbani dobara koshish karein.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: 'system',
      };
      setMessages((prev) => [...prev, errorReply]);
    } finally {
      setIsLoading(false);
      setTimeout(scrollToBottom, 100);
    }
  };

  const handleClearHistory = () => {
    const initialMsg: ChatMessageItem = {
      id: `init-${Date.now()}`,
      role: 'model',
      text: `**Salam! Main Sammi hoon — ${storeName} POS System ki AI Assistant.**\n\nChat conversation clear ho gaya hai. Aap mujhse koi bhi naya sawal pooch sakte hain!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      modelUsed: 'gemini-3.5-flash',
    };
    setMessages([initialMsg]);
    try {
      localStorage.removeItem('sammi_chat_history');
    } catch {}
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderMessageContent = (text: string) => {
    const lines = text.split('\n');

    return (
      <div className="space-y-2 text-sm sm:text-base leading-relaxed text-slate-800 dark:text-slate-100">
        {lines.map((line, idx) => {
          if (!line.trim()) return <div key={idx} className="h-2" />;

          const isBullet = line.trim().startsWith('* ') || line.trim().startsWith('- ');
          const cleanLine = isBullet ? line.trim().substring(2) : line;

          const boldParts = cleanLine.split(/(\*\*[^*]+\*\*)/g);
          const renderedLine = boldParts.map((bPart, bIdx) => {
            if (bPart.startsWith('**') && bPart.endsWith('**')) {
              return (
                <strong key={bIdx} className="font-bold text-slate-900 dark:text-white">
                  {bPart.slice(2, -2)}
                </strong>
              );
            }
            return <span key={bIdx}>{bPart}</span>;
          });

          if (isBullet) {
            return (
              <div key={idx} className="flex items-start gap-2.5 pl-1.5 sm:pl-2">
                <span className="text-purple-600 dark:text-purple-400 mt-1 select-none font-bold text-base">•</span>
                <span className="flex-1">{renderedLine}</span>
              </div>
            );
          }

          if (line.startsWith('### ')) {
            return (
              <h4 key={idx} className="font-bold text-base sm:text-lg text-purple-950 dark:text-purple-200 mt-3 mb-1.5 flex items-center gap-2">
                {line.replace('### ', '')}
              </h4>
            );
          }

          return <p key={idx}>{renderedLine}</p>;
        })}
      </div>
    );
  };

  return (
    <div className="w-full min-h-full bg-[#F8FAFC] dark:bg-[#0A0E1A] pt-5 sm:pt-7 pb-10 flex flex-col">
      {/* TOP HEADER: Clean, pristine, minimalist */}
      <div className="max-w-4xl lg:max-w-5xl xl:max-w-6xl w-full mx-auto px-4 sm:px-6 mb-6">
        <div className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 border border-slate-200 dark:border-purple-800/80 rounded-2xl p-4 sm:p-5 shadow-xs text-slate-800 dark:text-white flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300 border border-purple-500/20 dark:border-purple-400/30 flex items-center justify-center font-bold shadow-xs shrink-0">
              <Bot className="w-6 h-6 text-purple-600 dark:text-purple-300" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-white tracking-tight">
                  Sammi — AI Assistant
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-700/60 flex items-center gap-1.5 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live AI
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-purple-200/80 mt-0.5">
                {storeName} • Dynamic AI Conversations & Store Intelligence
              </p>
            </div>
          </div>

          {/* Right Controls: Model Mode & Clear Chat */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-purple-800/80 rounded-xl px-2.5 py-1.5 shadow-2xs">
              <Cpu className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
              <span className="text-xs font-bold text-slate-400 dark:text-purple-300/80 hidden sm:inline">
                Mode:
              </span>
              <select
                value={modelMode}
                onChange={(e) => setModelMode(e.target.value as any)}
                className="text-xs sm:text-sm font-semibold bg-transparent text-slate-700 dark:text-purple-100 border-none cursor-pointer focus:outline-none"
                title="Select Gemini Intelligence Mode"
              >
                <option value="fast" className="bg-white text-slate-900 dark:bg-[#131B2E] dark:text-white">
                  ⚡ Fast (3.1 Lite)
                </option>
                <option value="general" className="bg-white text-slate-900 dark:bg-[#131B2E] dark:text-white">
                  🧠 Standard (3.8 Flash)
                </option>
                <option value="complex" className="bg-white text-slate-900 dark:bg-[#131B2E] dark:text-white">
                  🔬 Deep (3.1 Pro)
                </option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleClearHistory}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-purple-800/80 bg-white dark:bg-[#131B2E] text-slate-600 dark:text-purple-200 hover:bg-slate-100 dark:hover:bg-purple-900/40 text-xs sm:text-sm font-semibold transition cursor-pointer shadow-2xs flex items-center gap-1.5"
              title="Clear conversation history"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Chat</span>
            </button>
          </div>
        </div>
      </div>

      {/* CHAT MESSAGES STREAM: Clean, open, natural page flow */}
      <div className="max-w-4xl lg:max-w-5xl xl:max-w-6xl w-full mx-auto px-4 sm:px-6 flex-1 space-y-5 mb-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`w-full flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`w-full sm:max-w-[85%] lg:max-w-[80%] rounded-2xl p-4 sm:p-6 transition-all ${
                msg.role === 'user'
                  ? 'bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 border border-slate-200 dark:border-purple-800/80 text-slate-800 dark:text-white shadow-xs rounded-br-xs ml-auto'
                  : 'bg-white dark:bg-[#131B2E] text-slate-800 dark:text-slate-100 border border-slate-200/90 dark:border-purple-800/80 shadow-xs rounded-bl-xs'
              }`}
            >
              {/* Header inside user message bubble */}
              {msg.role === 'user' && (
                <div className="flex items-center justify-between gap-3 pb-2.5 mb-2.5 border-b border-slate-200/80 dark:border-purple-800/50">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-600 dark:bg-purple-500/20 dark:text-purple-300 border border-blue-500/20 dark:border-purple-400/30 flex items-center justify-center font-bold text-xs shrink-0">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-white">
                      You
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-purple-200/70 bg-white/80 dark:bg-black/20 px-2 py-0.5 rounded-full border border-slate-200/60 dark:border-purple-700/40">
                    Prompt
                  </span>
                </div>
              )}

              {/* Header inside assistant message bubble */}
              {msg.role === 'model' && (
                <div className="flex items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-100 dark:border-purple-900/40">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 flex items-center justify-center font-bold text-xs shrink-0">
                      <Bot className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-sm text-purple-900 dark:text-purple-200">
                      Sammi • {storeName}
                    </span>
                  </div>
                  {msg.modelUsed && (
                    <span className="text-xs font-mono text-slate-500 dark:text-purple-300 bg-slate-100 dark:bg-[#1A233A] px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-purple-900/40">
                      {msg.modelUsed.includes('pro')
                        ? '🔬 3.1 Pro'
                        : msg.modelUsed.includes('lite')
                        ? '⚡ 3.1 Lite'
                        : msg.modelUsed.includes('rate-limit')
                        ? '⏳ Rate Limited'
                        : '🧠 3.8 Flash'}
                    </span>
                  )}
                </div>
              )}

              {/* Message text content */}
              {renderMessageContent(msg.text)}

              {/* Message Footer: Timestamp and copy button */}
              <div className={`flex items-center justify-between gap-2 mt-3 pt-2 text-xs border-t ${
                msg.role === 'user'
                  ? 'text-slate-500 dark:text-purple-300/80 border-slate-200/70 dark:border-purple-800/40'
                  : 'text-slate-400 dark:text-slate-500 border-slate-100/60 dark:border-purple-900/20'
              }`}>
                <span className="text-[11px]">{msg.timestamp}</span>
                <button
                  type="button"
                  onClick={() => handleCopyText(msg.id, msg.text)}
                  className="p-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-purple-900/40 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer flex items-center gap-1"
                  title="Copy message"
                >
                  {copiedId === msg.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-medium">Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Loading Bubble */}
        {isLoading && (
          <div className="w-full flex justify-start">
            <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-purple-800/80 rounded-2xl rounded-bl-xs p-4 sm:p-5 shadow-xs flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/60 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-purple-600 dark:text-purple-400 animate-pulse" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-purple-700 dark:text-purple-300 font-semibold">
                  Sammi is thinking...
                </span>
                <div className="flex items-center gap-1.5 ml-1">
                  <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* STICKY BOTTOM INPUT: ChatGPT / Gemini Style Centered Dock */}
      <div className="sticky bottom-0 z-30 pt-3 pb-4 sm:pb-6 bg-gradient-to-t from-[#F8FAFC] via-[#F8FAFC]/95 to-transparent dark:from-[#0A0E1A] dark:via-[#0A0E1A]/95 dark:to-transparent backdrop-blur-xs">
        <div className="max-w-4xl lg:max-w-5xl xl:max-w-6xl w-full mx-auto px-4 sm:px-6">
          <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-purple-800/80 rounded-2xl shadow-lg p-2.5 sm:p-3 transition-shadow focus-within:shadow-xl">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-end gap-2.5"
            >
              <div className="relative flex-1">
                <textarea
                  ref={inputRef}
                  rows={2}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Sammi se koi bhi sawal poochiye..."
                  disabled={isLoading}
                  className="w-full resize-none rounded-xl bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white px-3.5 py-2.5 text-sm sm:text-base focus:outline-none placeholder-slate-400 dark:placeholder-slate-500 border border-purple-300/80 dark:border-purple-700/60 max-h-36 overflow-y-auto"
                />
              </div>

              <button
                type="submit"
                disabled={!inputMessage.trim() || isLoading}
                className="px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white font-bold text-sm transition cursor-pointer disabled:cursor-not-allowed shadow-md shadow-purple-600/25 active:scale-95 shrink-0 flex items-center gap-2"
                title="Send message (Enter)"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>

            <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 mt-2 px-1.5">
              <span>Press <strong>Enter</strong> to send • <strong>Shift+Enter</strong> for newline</span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                Sammi AI Assistant
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
