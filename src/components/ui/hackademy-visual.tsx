"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { GraduationCap, Users, Trophy, BookOpen, CheckCircle, Play, Lock } from "lucide-react";

interface Module {
  id: number;
  title: string;
  duration: string;
  status: "completed" | "in-progress" | "locked";
  progress?: number;
}

const modules: Module[] = [
  { id: 1, title: "Fondamentaux des AO", duration: "2h", status: "completed" },
  { id: 2, title: "Analyse du DCE", duration: "1h30", status: "in-progress", progress: 65 },
  { id: 3, title: "Rédaction technique", duration: "3h", status: "locked" },
];

const stats = [
  { icon: Users, value: "350+", label: "Formés" },
  { icon: BookOpen, value: "12", label: "Modules" },
  { icon: Trophy, value: "94%", label: "Réussite" },
];

export default function HackademyVisual() {
  const [activeModule, setActiveModule] = useState(2);
  const [animatedProgress, setAnimatedProgress] = useState(0);

  useEffect(() => {
    const currentModule = modules[activeModule];
    if (currentModule?.status === "in-progress" && currentModule.progress) {
      const timer = setTimeout(() => {
        setAnimatedProgress(currentModule.progress || 0);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [activeModule]);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveModule((prev) => (prev + 1) % 3);
      setAnimatedProgress(0);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-full flex items-center justify-center p-3">
      <div className="w-full max-w-[420px] rounded-xl border border-border bg-card overflow-hidden shadow-xl">
        <div className="bg-gradient-to-r from-primary/20 to-primary/5 border-b border-border px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                <GraduationCap className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-foreground">Hackademy</h3>
                <p className="text-[10px] text-muted-foreground">Parcours Réponse AO</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-primary">40%</div>
              <div className="text-[9px] text-muted-foreground">Progression</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1 px-3 py-2 bg-muted/30 border-b border-border">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div key={idx} className="flex items-center gap-1.5 justify-center">
                <Icon className="w-3 h-3 text-primary" />
                <div>
                  <span className="text-[10px] font-semibold text-foreground">{stat.value}</span>
                  <span className="text-[9px] text-muted-foreground ml-0.5">{stat.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-2 space-y-1.5">
          {modules.map((module, idx) => {
            const isActive = idx === activeModule;
            const isCompleted = module.status === "completed";
            const isLocked = module.status === "locked";
            const isInProgress = module.status === "in-progress";

            return (
              <div
                key={module.id}
                className={cn(
                  "relative rounded-lg px-2.5 py-2 border transition-all duration-300",
                  isActive ? "bg-primary/10 border-primary/30" : isLocked ? "bg-muted/20 border-border/50 opacity-60" : "bg-card border-border"
                )}
              >
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-6 h-6 rounded flex items-center justify-center flex-shrink-0",
                    isCompleted ? "bg-green-500/20" : isInProgress ? "bg-primary/20" : "bg-muted"
                  )}>
                    {isCompleted ? <CheckCircle className="w-3 h-3 text-green-500" /> : isLocked ? <Lock className="w-3 h-3 text-muted-foreground" /> : <Play className="w-3 h-3 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className={cn("text-[11px] font-medium truncate", isLocked ? "text-muted-foreground" : "text-foreground")}>
                        {module.title}
                      </h4>
                      <span className="text-[9px] text-muted-foreground ml-2 flex-shrink-0">{module.duration}</span>
                    </div>
                    {isInProgress && (
                      <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
                          style={{ width: isActive ? `${animatedProgress}%` : `${module.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-3 py-2 border-t border-border bg-muted/20">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-muted-foreground">+9 modules disponibles</span>
            <div className="px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-[9px] font-medium">
              Continuer
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
