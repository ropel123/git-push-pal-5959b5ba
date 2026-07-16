"use client";

import { cn } from "@/lib/utils";
import { Download, Database, Share2, Lightbulb, RotateCw } from "lucide-react";

interface ProcessStep {
  id: number;
  label: string;
  icon: React.ElementType;
  position: "top" | "right" | "bottom" | "left";
}

const steps: ProcessStep[] = [
  { id: 1, label: "Acquisition", icon: Download, position: "top" },
  { id: 2, label: "Stockage", icon: Database, position: "right" },
  { id: 3, label: "Distribution", icon: Share2, position: "bottom" },
  { id: 4, label: "Utilisation", icon: Lightbulb, position: "left" },
];

function getPositionClasses(position: ProcessStep["position"]) {
  switch (position) {
    case "top": return "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2";
    case "right": return "right-0 top-1/2 translate-x-1/2 -translate-y-1/2";
    case "bottom": return "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2";
    case "left": return "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2";
  }
}

function getLabelPositionClasses(position: ProcessStep["position"]) {
  switch (position) {
    case "top": return "-top-14 left-1/2 -translate-x-1/2";
    case "right": return "top-1/2 -translate-y-1/2 -right-24 sm:-right-28";
    case "bottom": return "-bottom-14 left-1/2 -translate-x-1/2";
    case "left": return "top-1/2 -translate-y-1/2 -left-24 sm:-left-28";
  }
}

export default function KnowledgeCycle() {
  return (
    <div className="flex items-center justify-center w-full h-full p-8 sm:p-12">
      <div className="relative w-[180px] h-[180px] sm:w-[220px] sm:h-[220px]">
        <div className="absolute inset-4 sm:inset-6 rounded-full border-2 border-primary/30 flex items-center justify-center">
          <div className="relative w-full h-full">
            <div className="absolute inset-0 rounded-full overflow-hidden">
              <div className="absolute inset-0 animate-[spin_8s_linear_infinite]">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <defs>
                    <linearGradient id="cycleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
                      <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
                    </linearGradient>
                  </defs>
                  <circle cx="50" cy="50" r="45" fill="none" stroke="url(#cycleGradient)" strokeWidth="3" strokeDasharray="70 30 50 30" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                <RotateCw className="w-5 h-5 sm:w-6 sm:h-6 text-primary animate-[spin_4s_linear_infinite]" />
              </div>
            </div>
          </div>
        </div>

        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div key={step.id}>
              <div className={cn(
                "absolute w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-card border border-border flex items-center justify-center transition-all duration-300 hover:border-primary/50 hover:bg-primary/10 group z-10",
                getPositionClasses(step.position)
              )}>
                <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary group-hover:scale-110 transition-transform" />
              </div>
              <div className={cn("absolute whitespace-nowrap", getLabelPositionClasses(step.position))}>
                <span className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-[10px] sm:text-xs font-medium text-primary">
                  {step.label}
                </span>
              </div>
            </div>
          );
        })}

        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 200 200">
          <defs>
            <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="hsl(var(--primary))" opacity="0.6" />
            </marker>
          </defs>
          <path d="M 120 35 Q 165 45, 165 80" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeOpacity="0.4" markerEnd="url(#arrowhead)" />
          <path d="M 165 120 Q 165 155, 120 165" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeOpacity="0.4" markerEnd="url(#arrowhead)" />
          <path d="M 80 165 Q 35 155, 35 120" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeOpacity="0.4" markerEnd="url(#arrowhead)" />
          <path d="M 35 80 Q 35 45, 80 35" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeOpacity="0.4" markerEnd="url(#arrowhead)" />
        </svg>
      </div>
    </div>
  );
}
