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
    <div className="flex flex-col h-[85vh] w-full max-w-5xl glass rounded-[2rem] overflow-hidden animate-fadeIn">
      {/* Header */}
      <div className="px-8 py-5 border-b border-[#d7e3f2] flex items-center justify-between bg-[#f1f6fc]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-[#e6effc] border border-[#d4e2f5] shadow-[inset_3px_3px_8px_rgba(172,191,214,0.35),inset_-3px_-3px_8px_rgba(255,255,255,0.95)]">
            <Bot size={20} className="text-[#4568bb]" />
          </div>
          <div>
            <h2 className="font-bold text-lg tracking-tight text-[#22365f]">Antigravity AI</h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#74a2ff] animate-pulse" />
              <span className="text-xs text-[#88a0c4] font-semibold uppercase tracking-widest">Active Now</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={toggleTts}
            className={`p-2 rounded-xl border transition-all ${isTtsEnabled ? 'text-[#4f7cf7] bg-[#e8f0ff] border-[#bfd2f3]' : 'text-[#9fb1cd] bg-[#edf3fb] border-[#d7e3f2]'}`}
            title={isTtsEnabled ? "Disable TTS" : "Enable TTS"}
          >
            {isTtsEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#edf3fb] border border-[#d7e3f2] text-[10px] text-[#90a5c6] font-mono">
            <Command size={10} className="text-[#90a5c6]" />
            <span>V2.5 FLASH</span>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-8 space-y-6 scroll-smooth bg-[#f6faff]"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-70">
            <Sparkles size={48} className="text-[#7ea1de]" />
            <p className="text-lg font-semibold text-[#4c6590]">How can I help you today?</p>
            <p className="text-sm max-w-xs text-[#7f95b8]">Upload a PDF or talk naturally. Send messages manually for better control.</p>
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
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border ${
                  msg.role === 'user' 
                    ? 'bg-[#4f7cf7] text-white border-[#4f7cf7]' 
                    : 'bg-[#ecf2fb] text-[#4c6a9e] border-[#d7e3f2]'
                }`}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-[#5f8cff] to-[#4f7cf7] text-white rounded-tr-none shadow-[0_8px_24px_rgba(79,124,247,0.25)]'
                    : 'bg-[#edf3fb] border border-[#d7e3f2] text-[#2e4469] rounded-tl-none'
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
              <div className="w-8 h-8 rounded-full bg-[#ecf2fb] border border-[#d7e3f2] text-[#4c6a9e] flex items-center justify-center">
                <Bot size={16} className="animate-pulse" />
              </div>
              <div className="flex gap-1.5 px-4 py-4 rounded-2xl bg-[#edf3fb] border border-[#d7e3f2]">
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
        <div className="px-6 py-2 bg-[#eef5ff] border-t border-[#d7e3f2] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-[#4568bb] font-semibold">
            <FileText size={14} />
            <span>Active context: {uploadedFileName}</span>
            <button 
              onClick={handleSummarize}
              disabled={isSummarizing}
              className="ml-3 px-3 py-1 rounded-full bg-[#4f7cf7] text-white text-[10px] font-bold hover:bg-[#416fe7] transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSummarizing ? (
                <>
                  <div className="w-2 h-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
          <button onClick={clearPdfContext} className="p-1 hover:bg-[#e0eaf8] rounded-md transition-all text-[#91a7c8] hover:text-[#4b689c]">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-6 bg-[#f1f6fc] border-t border-[#d7e3f2]">
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
            className={`p-3 rounded-2xl transition-all bg-[#edf3fb] text-[#93a8c8] border border-[#d7e3f2] hover:bg-[#e6eefb] hover:text-[#4b689c] ${isUploading ? 'opacity-50 cursor-wait' : ''}`}
          >
            <Paperclip size={20} className={isUploading ? 'animate-bounce' : ''} />
          </button>
          
          <button
            type="button"
            onClick={toggleListening}
            className={`p-3 rounded-2xl transition-all ${
              isListening 
                ? 'bg-[#ff7a88] text-white border border-[#ff7a88] shadow-lg shadow-[#ff7a8840]' 
                : 'bg-[#edf3fb] text-[#93a8c8] border border-[#d7e3f2] hover:bg-[#e6eefb] hover:text-[#4b689c]'
            }`}
          >
            {isListening ? <Mic size={20} /> : <MicOff size={20} />}
          </button>

          <button
            type="button"
            onClick={() => setIsSearchEnabled((prev) => !prev)}
            className={`p-3 rounded-2xl transition-all border ${
              isSearchEnabled
                ? 'bg-[#e7eeff] text-[#4f7cf7] border-[#bfd2f3] shadow-lg shadow-[#9ebdf540]'
                : 'bg-[#edf3fb] text-[#93a8c8] border-[#d7e3f2] hover:bg-[#e6eefb] hover:text-[#4b689c]'
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
              className="w-full inset-soft rounded-3xl py-4 pl-6 pr-14 focus:outline-none focus:ring-2 focus:ring-[#7fa5ff]/40 transition-all placeholder:text-[#b5c5dc] text-sm text-[#2f456b]"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-2xl bg-[#4f7cf7] hover:bg-[#416fe7] disabled:opacity-50 disabled:hover:bg-[#4f7cf7] transition-all shadow-[0_10px_22px_rgba(79,124,247,0.32)] text-white"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
        <p className="mt-3 text-[10px] text-center text-[#99acc8] tracking-wider font-semibold">
          POWERED BY GEMINI 2.5 FLASH • MANUAL SUBMIT MODE • SECURE & ANONYMOUS
        </p>
        <p className={`mt-1 text-[10px] text-center tracking-wider font-semibold ${isSearchEnabled ? 'text-[#4f7cf7]' : 'text-[#99acc8]'}`}>
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#c8d8ec]/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#f3f8fd] border border-[#d7e3f2] w-full max-w-3xl max-h-[80vh] rounded-3xl overflow-hidden flex flex-col shadow-[0_20px_45px_rgba(131,154,186,0.35)]"
            >
              <div className="p-6 border-b border-[#d7e3f2] flex items-center justify-between bg-[#eef5ff]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#4f7cf7] text-white">
                    <FileCheck size={20} />
                  </div>
                  <h3 className="text-xl font-bold text-[#22365f]">Analysis Report</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#edf3fb] hover:bg-[#e4eefb] border border-[#d7e3f2] transition-all text-sm font-semibold text-[#2e4469]"
                  >
                    <Printer size={16} />
                    Print
                  </button>
                  <button
                    onClick={() => setIsReportModalOpen(false)}
                    className="p-2 hover:bg-[#e4eefb] rounded-xl transition-all text-[#91a7c8] hover:text-[#4b689c]"
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
              
              <div className="p-6 border-t border-[#d7e3f2] bg-[#eef5ff] text-center">
                <p className="text-[10px] text-[#99acc8] uppercase tracking-widest font-bold">
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
