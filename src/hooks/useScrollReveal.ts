import { useEffect } from "react";

/**
 * Active les éléments `.reveal` (+ `.reveal-left` / `.reveal-right`)
 * quand ils entrent dans le viewport, et anime les compteurs `[data-count]`.
 * À appeler une fois par page (ex. dans Index.tsx).
 */
export function useScrollReveal() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fmt = new Intl.NumberFormat("fr-FR");

    // ── Reveals ──
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    let io: IntersectionObserver | null = null;
    if (reduced) {
      els.forEach((el) => el.classList.add("is-visible"));
    } else {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const el = entry.target as HTMLElement;
              const delay = Number(el.dataset.revealDelay || 0);
              setTimeout(() => el.classList.add("is-visible"), delay);
              io!.unobserve(el);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
      );
      els.forEach((el) => io!.observe(el));
    }

    // ── Compteurs ──
    const counters = Array.from(document.querySelectorAll<HTMLElement>("[data-count]"));
    const cio = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          cio.unobserve(el);
          const target = Number(el.dataset.count);
          if (reduced) {
            el.textContent = fmt.format(target);
            return;
          }
          const start = performance.now();
          const dur = 1600;
          const tick = (now: number) => {
            const p = Math.min(1, (now - start) / dur);
            const eased = 1 - Math.pow(1 - p, 4);
            el.textContent = fmt.format(Math.round(target * eased));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
      },
      { threshold: 0.5 }
    );
    counters.forEach((el) => cio.observe(el));

    return () => {
      io?.disconnect();
      cio.disconnect();
    };
  }, []);
}

/**
 * Tilt 3D subtil au survol (±4°) pour les mockups `[data-tilt]`.
 */
export function useTilt() {
  useEffect(() => {
    if (!window.matchMedia("(hover: hover)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const cleanups: Array<() => void> = [];
    document.querySelectorAll<HTMLElement>("[data-tilt]").forEach((el) => {
      el.style.transition = "transform 0.18s ease-out";
      el.style.willChange = "transform";
      const move = (e: MouseEvent) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(1200px) rotateX(${(-y * 4).toFixed(2)}deg) rotateY(${(x * 5).toFixed(2)}deg) scale(1.005)`;
      };
      const leave = () => {
        el.style.transition = "transform 0.7s cubic-bezier(0.22,1,0.36,1)";
        el.style.transform = "perspective(1200px) rotateX(0deg) rotateY(0deg) scale(1)";
        setTimeout(() => (el.style.transition = "transform 0.18s ease-out"), 700);
      };
      el.addEventListener("mousemove", move, { passive: true });
      el.addEventListener("mouseleave", leave);
      cleanups.push(() => {
        el.removeEventListener("mousemove", move);
        el.removeEventListener("mouseleave", leave);
      });
    });
    return () => cleanups.forEach((fn) => fn());
  }, []);
}
