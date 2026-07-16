"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

export default function BeforeAfterSlides() {
  const [showAfter, setShowAfter] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setShowAfter((prev) => !prev);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-full flex items-center justify-center p-4 cursor-pointer" onClick={() => setShowAfter(!showAfter)}>
      <div className="relative w-full max-w-[480px]">
        <div className="rounded-xl overflow-hidden border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-primary flex items-center justify-center">
                <span className="text-[8px] font-bold text-primary-foreground">P</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {showAfter ? "Proposition_HACKIFY.pptx" : "proposition_v12_final.pptx"}
              </span>
            </div>
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-muted-foreground/20" />
              <div className="w-3 h-3 rounded-full bg-muted-foreground/20" />
              <div className="w-3 h-3 rounded-full bg-muted-foreground/20" />
            </div>
          </div>

          <div className="relative aspect-[16/10] overflow-hidden">
            <div className={cn(
              "absolute inset-0 bg-white p-4 sm:p-6 transition-all duration-700 ease-out",
              showAfter ? "opacity-0 scale-95 -rotate-3" : "opacity-100 scale-100 rotate-0"
            )}>
              <div className="bg-blue-700 text-white px-3 py-1.5 text-sm sm:text-base font-bold mb-4 inline-block">
                NOTRE PROPOSITION COMMERCIALE
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-red-500 rounded-sm flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="h-3 bg-gray-800 w-48 sm:w-64 rounded-sm" />
                    <div className="h-2 bg-gray-400 w-32 sm:w-48 rounded-sm" />
                  </div>
                </div>
                <div className="flex items-start gap-3 ml-6">
                  <div className="w-4 h-4 bg-green-500 rounded-full flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="h-3 bg-gray-800 w-40 sm:w-56 rounded-sm" />
                    <div className="h-2 bg-gray-400 w-24 sm:w-36 rounded-sm" />
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-5 bg-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="h-3 bg-gray-800 w-36 sm:w-52 rounded-sm" />
                  </div>
                </div>
              </div>
              <div className="absolute bottom-4 right-4 w-16 h-16 bg-gradient-to-br from-blue-400 to-purple-600 rounded-full opacity-40" />
              <div className="absolute top-16 right-6 w-6 h-6 bg-orange-400 rotate-45" />
            </div>

            <div className={cn(
              "absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-6 transition-all duration-700 ease-out",
              showAfter ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-105 rotate-3"
            )}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-8 bg-primary rounded-full" />
                  <span className="text-white text-sm sm:text-lg font-medium tracking-wide">
                    Proposition Commerciale
                  </span>
                </div>
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-white/5 rounded-xl p-3 sm:p-4 border border-white/10">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 mb-3 flex items-center justify-center">
                    <div className="w-4 h-4 bg-primary rounded" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-2 bg-white/60 w-full rounded-full" />
                    <div className="h-2 bg-white/30 w-3/4 rounded-full" />
                  </div>
                </div>

                <div className="bg-white/5 rounded-xl p-3 sm:p-4 border border-white/10">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 mb-3 flex items-center justify-center">
                    <div className="w-4 h-4 bg-primary rounded-full" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-2 bg-white/60 w-full rounded-full" />
                    <div className="h-2 bg-white/30 w-2/3 rounded-full" />
                  </div>
                </div>

                <div className="col-span-2 bg-gradient-to-r from-primary/15 to-primary/5 rounded-xl p-3 sm:p-4 border border-primary/30">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-primary/30 flex items-center justify-center">
                      <span className="text-primary text-lg sm:text-xl font-bold">+42%</span>
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <div className="h-2 bg-white/60 w-3/4 rounded-full" />
                      <div className="h-2 bg-white/30 w-1/2 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={cn(
          "absolute -bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-xs font-semibold shadow-lg transition-all duration-500",
          showAfter ? "bg-primary text-primary-foreground" : "bg-red-500 text-white"
        )}>
          {showAfter ? "APRÈS ✨" : "AVANT"}
        </div>

        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full transition-all duration-300", !showAfter ? "bg-red-500 scale-110" : "bg-muted-foreground/30")} />
          <div className={cn("w-2 h-2 rounded-full transition-all duration-300", showAfter ? "bg-primary scale-110" : "bg-muted-foreground/30")} />
        </div>
      </div>
    </div>
  );
}
