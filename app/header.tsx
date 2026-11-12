import type { ReactNode } from "react";

export function Header({ children }: { children?: ReactNode }) {
  return <header className="flex items-center justify-between border-b border-white/[.09] pb-6">
    <div className="flex items-center gap-3"><div className="brand-mark"><span /><span /><span /><span /></div><span className="text-[19px] font-semibold tracking-[-.065em]">valythm<span className="text-red-600">.</span></span></div>
    {children}
  </header>;
}

export function Shell({ children }: { children: ReactNode }) {
  return <main className="min-h-dvh bg-black text-white selection:bg-red-700/60">
    <div className="mx-auto flex min-h-dvh max-w-[1536px] flex-col px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-6 sm:px-10 sm:pt-9 lg:px-[72px]">{children}</div>
  </main>;
}
