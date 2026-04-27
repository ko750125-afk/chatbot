'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Sparkles, Command, Mic, MicOff, Volume2, VolumeX, Paperclip, X, FileText, Printer, FileCheck, Search } from 'lucide-react';
import { sendMessage, Message, uploadPdf, summarizePdf } from '@/lib/api';
import ReactMarkdown from 'react-markdown';

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTtsEnabled, setIsTtsEnabled] = useState(false); // Default to OFF
  const [pdfContext, setPdfContext] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [reportContent, setReportContent] = useState('');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isSearchEnabled, setIsSearchEnabled] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef(''); // To track latest input in callbacks
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync input ref with state
  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  const speak = useCallback((text: string) => {
    if (!isTtsEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;

    // Cancel previous speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    
    // Try to find a good Korean voice
    const voices = window.speechSynthesis.getVoices();
    const koVoice = voices.find(v => v.lang.includes('ko'));
    if (koVoice) utterance.voice = koVoice;

    window.speechSynthesis.speak(utterance);
  }, [isTtsEnabled]);

  const handleSendMessage = useCallback(async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const userMessage = textToSend.trim();
    setInput('');
    inputRef.current = '';
    
    const newUserMessage: Message = { role: 'user', parts: [{ text: userMessage }] };
    setMessages(prev => [...prev, newUserMessage]);
    
    setIsLoading(true);

    try {
      const result = await sendMessage(userMessage, messages, pdfContext, isSearchEnabled);
      const aiMessage: Message = { role: 'model', parts: [{ text: result.response }] };
      setMessages(prev => [...prev, aiMessage]);
      
      // Auto-read AI response if TTS is enabled
      speak(result.response);
    } catch (error) {
      console.error('Failed to get AI response:', error);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, speak, pdfContext, isSearchEnabled]);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).webkitSpeechRecognition) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true; // Keep listening until manual stop
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'ko-KR';

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setInput(prev => prev + (prev ? ' ' : '') + finalTranscript);
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        // Removed auto-submit on end for manual mode
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
    }
  }, []); // Only init once

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      // Stop any current speaking when starting to listen
      window.speechSynthesis.cancel();
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const toggleTts = () => {
    setIsTtsEnabled(!isTtsEnabled);
    if (!isTtsEnabled === false) { // If turning OFF
      window.speechSynthesis.cancel();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await uploadPdf(file);
      setPdfContext(result.text);
      setUploadedFileName(file.name);
      
      // Notify user in chat
      const systemMsg: Message = { 
        role: 'model', 
        parts: [{ text: `📁 File "${file.name}" uploaded successfully. I will now refer to this content in our conversation.` }] 
      };
      setMessages(prev => [...prev, systemMsg]);
    } catch (error: any) {
      alert(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const clearPdfContext = () => {
    setPdfContext('');
    setUploadedFileName('');
  };

  const handleSummarize = async () => {
    if (!pdfContext || isSummarizing) return;
    
    setIsSummarizing(true);
    try {
      const result = await summarizePdf(pdfContext);
      setReportContent(result.summary);
      setIsReportModalOpen(true);
    } catch (error: any) {
      alert(`Summarization failed: ${error.message}`);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handlePrint = () => {
    const printContent = document.getElementById('report-content');
    if (!printContent) return;
    
    const originalContents = document.body.innerHTML;
    const printWindow = window.open('', '', 'height=600,width=800');
    
    if (printWindow) {
      printWindow.document.write('<html><head><title>Summary Report</title>');
      printWindow.document.write('<style>body{font-family: sans-serif; padding: 40px; line-height: 1.6;} h1{color: #2563eb;} ul{margin-bottom: 20px;} li{margin-bottom: 10px;}</style>');
      printWindow.document.write('</head><body>');
      printWindow.document.write(printContent.innerHTML);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isListening) recognitionRef.current.stop();
    handleSendMessage(input);
  };

  return (
    <div className="flex flex-col h-[85vh] w-full max-w-4xl glass rounded-3xl overflow-hidden animate-fadeIn">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-blue-500/20">
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg tracking-tight">Antigravity AI</h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-white/50 font-medium uppercase tracking-widest">Active Now</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={toggleTts}
            className={`p-2 rounded-lg transition-all ${isTtsEnabled ? 'text-cyan-400 bg-cyan-400/10' : 'text-white/20 bg-white/5'}`}
            title={isTtsEnabled ? "Disable TTS" : "Enable TTS"}
          >
            {isTtsEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-white/40 font-mono">
            <Command size={10} />
            <span>V2.5 FLASH</span>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
            <Sparkles size={48} className="text-cyan-400" />
            <p className="text-lg font-medium">How can I help you today?</p>
            <p className="text-sm max-w-xs">Upload a PDF or talk naturally. Send messages manually for better control.</p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-md ${
                  msg.role === 'user' 
                    ? 'bg-blue-600' 
                    : 'bg-white/10 border border-white/10'
                }`}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-tr-none shadow-lg shadow-blue-900/20'
                    : 'bg-white/10 border border-white/10 backdrop-blur-sm rounded-tl-none'
                }`}>
                  {msg.parts[0].text}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <Bot size={16} className="animate-pulse" />
              </div>
              <div className="flex gap-1.5 px-4 py-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="typing-dot" style={{ animationDelay: '0s' }} />
                <div className="typing-dot" style={{ animationDelay: '0.2s' }} />
                <div className="typing-dot" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* PDF Indicator */}
      {uploadedFileName && (
        <div className="px-6 py-2 bg-cyan-400/5 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-cyan-400 font-medium">
            <FileText size={14} />
            <span>Active context: {uploadedFileName}</span>
            <button 
              onClick={handleSummarize}
              disabled={isSummarizing}
              className="ml-3 px-3 py-1 rounded-full bg-cyan-400 text-black text-[10px] font-bold hover:bg-cyan-300 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSummarizing ? (
                <>
                  <div className="w-2 h-2 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Summarizing...
                </>
              ) : (
                <>
                  <FileCheck size={12} />
                  Generate Report
                </>
              )}
            </button>
          </div>
          <button onClick={clearPdfContext} className="p-1 hover:bg-white/10 rounded-md transition-all text-white/40 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-6 bg-white/5 border-t border-white/10">
        <div className="relative flex items-center gap-3">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".pdf" 
            className="hidden" 
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={`p-3 rounded-2xl transition-all bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 hover:text-white ${isUploading ? 'opacity-50 cursor-wait' : ''}`}
          >
            <Paperclip size={20} className={isUploading ? 'animate-bounce' : ''} />
          </button>
          
          <button
            type="button"
            onClick={toggleListening}
            className={`p-3 rounded-2xl transition-all ${
              isListening 
                ? 'bg-red-500 text-white border border-red-500 shadow-lg shadow-red-500/20' 
                : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 hover:text-white'
            }`}
          >
            {isListening ? <Mic size={20} /> : <MicOff size={20} />}
          </button>

          <button
            type="button"
            onClick={() => setIsSearchEnabled((prev) => !prev)}
            className={`p-3 rounded-2xl transition-all border ${
              isSearchEnabled
                ? 'bg-cyan-400/20 text-cyan-300 border-cyan-300/40 shadow-lg shadow-cyan-500/20'
                : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white'
            }`}
            title={isSearchEnabled ? 'Google Search Grounding ON' : 'Google Search Grounding OFF'}
          >
            <Search size={20} />
          </button>
          
          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? "Listening... (Click mic again to stop)" : "Type your message here..."}
              className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-6 pr-14 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-white/20 text-sm"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 transition-all shadow-lg shadow-blue-900/40"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
        <p className="mt-3 text-[10px] text-center text-white/20 tracking-wider font-medium">
          POWERED BY GEMINI 2.5 FLASH • MANUAL SUBMIT MODE • SECURE & ANONYMOUS
        </p>
        <p className={`mt-1 text-[10px] text-center tracking-wider font-medium ${isSearchEnabled ? 'text-cyan-300/80' : 'text-white/20'}`}>
          SEARCH GROUNDING: {isSearchEnabled ? 'ON' : 'OFF'}
        </p>
      </form>

      {/* Report Modal */}
      <AnimatePresence>
        {isReportModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-white/10 w-full max-w-3xl max-h-[80vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-cyan-400 text-black">
                    <FileCheck size={20} />
                  </div>
                  <h3 className="text-xl font-bold">Analysis Report</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-sm font-medium"
                  >
                    <Printer size={16} />
                    Print
                  </button>
                  <button
                    onClick={() => setIsReportModalOpen(false)}
                    className="p-2 hover:bg-white/10 rounded-xl transition-all text-white/40 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 prose-custom max-w-none">
                <div id="report-content">
                  <ReactMarkdown>{reportContent}</ReactMarkdown>
                </div>
              </div>
              
              <div className="p-6 border-t border-white/10 bg-black/20 text-center">
                <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">
                  Generated by Antigravity AI Engine • {new Date().toLocaleDateString()}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
