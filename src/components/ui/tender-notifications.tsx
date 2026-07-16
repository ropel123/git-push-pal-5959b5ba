"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Building2, Calendar, Euro, Tag, ExternalLink } from "lucide-react";

interface TenderNotificationProps {
  className?: string;
  organization?: string;
  title?: string;
  budget?: string;
  deadline?: string;
  category?: string;
  isNew?: boolean;
  onHover?: () => void;
  onLeave?: () => void;
  isActive?: boolean;
  onTap?: () => void;
}

function TenderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function NewBadge() {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium bg-primary/20 text-primary border border-primary/30">
      Nouveau
    </span>
  );
}

function TenderNotification({
  className,
  organization = "Ministère de l'Économie",
  title = "Transformation digitale des services publics",
  budget = "2.5M€",
  deadline = "15 Fév 2025",
  category = "IT & Digital",
  isNew = false,
  onHover,
  onLeave,
  isActive,
  onTap,
}: TenderNotificationProps) {
  const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) {
      if (!isActive) {
        e.preventDefault();
        onTap?.();
      }
    }
  };

  return (
    <div
      onClick={handleClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={cn(
        "relative flex h-auto min-h-[140px] sm:min-h-[160px] w-[260px] sm:w-[340px] -skew-y-[8deg] select-none flex-col rounded-2xl border border-border bg-card/90 backdrop-blur-sm px-3 sm:px-4 py-3 sm:py-4 transition-all duration-500 hover:border-primary/50 hover:bg-card cursor-pointer",
        "dark:after:absolute dark:after:-right-1 dark:after:top-[-5%] dark:after:h-[110%] dark:after:w-[20rem] dark:after:bg-gradient-to-l dark:after:from-background dark:after:to-transparent dark:after:content-[''] dark:after:pointer-events-none",
        isActive && "ring-2 ring-primary/50",
        className
      )}
    >
      <div className="flex items-start gap-2 sm:gap-3 mb-2 sm:mb-3">
        <div className="size-9 sm:size-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center overflow-hidden shrink-0">
          <Building2 className="size-4 sm:size-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground truncate text-xs sm:text-sm">{organization}</span>
            {isNew && <NewBadge />}
          </div>
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] sm:text-xs mt-0.5">
            <Tag className="size-3" />
            <span>{category}</span>
          </div>
        </div>
        <TenderIcon className="size-4 sm:size-5 text-muted-foreground shrink-0" />
      </div>

      <p className="text-foreground text-xs sm:text-sm font-medium leading-relaxed mb-2 sm:mb-3 line-clamp-2">
        {title}
      </p>

      <div className="flex items-center justify-between text-muted-foreground text-[10px] sm:text-xs mt-auto">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-1">
            <Euro className="size-3 sm:size-3.5 text-primary" />
            <span className="font-medium text-foreground">{budget}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="size-3 sm:size-3.5" />
            <span>{deadline}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors">
          <span className="text-[10px] sm:text-xs">Voir</span>
          <ExternalLink className="size-3" />
        </div>
      </div>
    </div>
  );
}

interface TenderNotificationsProps {
  cards?: TenderNotificationProps[];
}

export default function TenderNotifications({ cards }: TenderNotificationsProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const getCardClassName = (index: number, baseClassName: string) => {
    const focusedIndex = hoveredIndex ?? activeIndex;

    if (focusedIndex === 0 && index === 1) {
      return baseClassName + " !translate-y-20 sm:!translate-y-28 !translate-x-12 sm:!translate-x-20";
    }
    if (focusedIndex === 0 && index === 2) {
      return baseClassName + " !translate-y-28 sm:!translate-y-40 !translate-x-20 sm:!translate-x-36";
    }
    if (focusedIndex === 1 && index === 2) {
      return baseClassName + " !translate-y-24 sm:!translate-y-36 !translate-x-20 sm:!translate-x-36";
    }
    return baseClassName;
  };

  const handleTap = (index: number) => {
    if (activeIndex === index) return;
    setActiveIndex(index);
  };

  const defaultCards: TenderNotificationProps[] = [
    {
      className: "[grid-area:stack] hover:-translate-y-10 before:absolute before:w-[100%] before:outline-1 before:rounded-2xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-background/50 grayscale-[80%] hover:before:opacity-0 before:transition-opacity before:duration-500 hover:grayscale-0 before:left-0 before:top-0",
      organization: "SNCF Réseau",
      title: "Modernisation du système de signalisation ferroviaire",
      budget: "4.2M€",
      deadline: "28 Jan 2025",
      category: "Infrastructure",
      isNew: false,
    },
    {
      className: "[grid-area:stack] translate-x-6 sm:translate-x-12 translate-y-6 sm:translate-y-10 hover:-translate-y-1 before:absolute before:w-[100%] before:outline-1 before:rounded-2xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-background/50 grayscale-[80%] hover:before:opacity-0 before:transition-opacity before:duration-500 hover:grayscale-0 before:left-0 before:top-0",
      organization: "Région Île-de-France",
      title: "Plateforme de gestion des transports en commun",
      budget: "1.8M€",
      deadline: "15 Fév 2025",
      category: "IT & Digital",
      isNew: true,
    },
    {
      className: "[grid-area:stack] translate-x-12 sm:translate-x-24 translate-y-12 sm:translate-y-20 hover:translate-y-6 sm:hover:translate-y-10",
      organization: "Ministère de la Santé",
      title: "Déploiement d'une solution de télémédecine nationale",
      budget: "8.5M€",
      deadline: "1 Mar 2025",
      category: "Santé",
      isNew: true,
    },
  ];

  const displayCards = cards || defaultCards;

  return (
    <div className="grid [grid-template-areas:'stack'] place-items-center opacity-100 animate-in fade-in-0 duration-700">
      {displayCards.map((cardProps, index) => (
        <TenderNotification
          key={index}
          {...cardProps}
          className={getCardClassName(index, cardProps.className || "")}
          onHover={() => setHoveredIndex(index)}
          onLeave={() => setHoveredIndex(null)}
          isActive={activeIndex === index}
          onTap={() => handleTap(index)}
        />
      ))}
    </div>
  );
}

export { TenderNotification, TenderNotifications };
