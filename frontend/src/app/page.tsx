import ChatInterface from '@/components/ChatInterface';

export default function Home() {
  return (
    <main className="relative flex flex-col items-center justify-center min-h-screen p-4 md:p-8 overflow-hidden">
      {/* Decorative Glow Background */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
      
      {/* App Content */}
      <div className="z-10 w-full flex flex-col items-center gap-8">
        <div className="text-center space-y-2 animate-fadeIn">
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-white/50">
            ANTIGRAVITY CHAT
          </h1>
          <p className="text-white/40 text-sm md:text-base font-medium tracking-wide">
            Next-gen AI interaction without boundaries.
          </p>
        </div>

        <ChatInterface />

        <footer className="mt-8 text-white/20 text-[11px] font-medium tracking-[0.2em] uppercase">
          © 2026 Antigravity Systems • All rights reserved
        </footer>
      </div>
    </main>
  );
}
