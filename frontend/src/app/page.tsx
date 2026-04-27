import ChatInterface from '@/components/ChatInterface';

export default function Home() {
  return (
    <main className="relative flex flex-col items-center justify-center min-h-screen p-4 md:p-8 overflow-hidden">
      {/* App Content */}
      <div className="z-10 w-full flex flex-col items-center gap-8">
        <div className="text-center space-y-2 animate-fadeIn">
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-[#1f2f56] drop-shadow-[0_2px_0_rgba(255,255,255,0.9)]">
            ANTIGRAVITY CHAT
          </h1>
          <p className="text-[#7f95b8] text-sm md:text-base font-semibold tracking-[0.12em]">
            Next-gen AI interaction without boundaries.
          </p>
        </div>

        <ChatInterface />

        <footer className="mt-8 text-[#98abc8] text-[11px] font-semibold tracking-[0.2em] uppercase">
          © 2026 Antigravity Systems • All rights reserved
        </footer>
      </div>
    </main>
  );
}
