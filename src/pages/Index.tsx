import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Search,
  Brain,
  FileText,
  Lock,
  Globe,
  Shield,
  ShieldCheck,
  Users,
  ClipboardCheck,
  Download,
  AlertTriangle,
} from "lucide-react";
import { getPlan, plansByCategory, ASSISTANT_FEATURES, EXPERT_FEATURES, PRICING_FOOTNOTE } from "@/lib/pricing";
import { useScrollReveal, useTilt } from "@/hooks/useScrollReveal";
import GastonLogo from "@/components/brand/GastonLogo";

/* ────────────────────────────────────────────────────────────────
   Landing officielle Gaston — design v2 "Premium SaaS"
   Blanc pur · #3D4EC7→#7583EA · Inter · motion premium
   ──────────────────────────────────────────────────────────────── */

const EASE = "cubic-bezier(0.22,1,0.36,1)";

const Sheen = () => (
  <span
    aria-hidden
    className="pointer-events-none absolute bottom-0 left-0 top-0 w-[55%]"
    style={{
      background: "linear-gradient(105deg, transparent, rgba(255,255,255,0.35), transparent)",
      transform: "translateX(-160%) skewX(-20deg)",
      animation: "hao-sheen 4s cubic-bezier(0.4,0,0.2,1) 1.2s infinite",
    }}
  />
);

const CheckRow = ({ children, from = "#3D4EC7", to = "#5563DD" }: { children: React.ReactNode; from?: string; to?: string }) => (
  <div className="flex items-center gap-3 text-[15px] text-gray-700">
    <span
      className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full"
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      <Check className="h-3 w-3 text-white" strokeWidth={3} />
    </span>
    {children}
  </div>
);

const Index = () => {
  useScrollReveal();
  useTilt();

  const sourcing = getPlan("sourcing_monthly");
  const sourcingOption = getPlan("sourcing_extra_email");
  const assistantPlans = plansByCategory("assistant");
  const expertPlans = plansByCategory("expert");

  // Nav blur + barre de progression
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setScrolled(window.scrollY > 24);
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setProgress(max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-[#111827]">
      {/* ═════════ NAV ═════════ */}
      <nav
        className="fixed inset-x-0 top-0 z-50 px-5 transition-all duration-500 md:px-12"
        style={{
          background: scrolled ? "rgba(255,255,255,0.78)" : "transparent",
          backdropFilter: scrolled ? "blur(16px) saturate(1.6)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(16px) saturate(1.6)" : "none",
          boxShadow: scrolled ? "0 1px 0 rgba(0,0,0,0.06), 0 8px 24px rgba(17,24,39,0.05)" : "none",
        }}
      >
        <span
          className="absolute left-0 top-0 h-[2.5px] rounded-r"
          style={{ width: `${progress}%`, background: "linear-gradient(90deg,#3D4EC7,#5563DD,#7583EA)" }}
        />
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-6">
          <Link to="/" className="flex items-center">
            <GastonLogo size={26} />
          </Link>
          <div className="hidden items-center gap-9 text-[14.5px] font-medium text-gray-500 md:flex">
            <a href="#fonctionnalites" className="transition-colors hover:text-[#111827]">Fonctionnalités</a>
            <a href="#securite" className="transition-colors hover:text-[#111827]">Sécurité</a>
            <a href="#tarifs" className="transition-colors hover:text-[#111827]">Tarifs</a>
            <a href="#faq" className="transition-colors hover:text-[#111827]">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth" className="hidden text-sm font-medium text-gray-500 transition-colors hover:text-[#111827] sm:block">
              Connexion
            </Link>
            <Link
              to="/auth"
              className="whitespace-nowrap rounded-full bg-[#111827] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(17,24,39,0.25)]"
            >
              Essayer la plateforme
            </Link>
          </div>
        </div>
      </nav>

      {/* ═════════ HERO ═════════ */}
      <section id="top" className="relative overflow-hidden px-5 pb-16 pt-32 md:px-12 md:pb-28 md:pt-44">
        <div className="bg-grid-light pointer-events-none absolute inset-0" />
        <div
          className="pointer-events-none absolute -top-44 left-[8%] h-[520px] w-[520px] rounded-full blur-[40px]"
          style={{ background: "radial-gradient(circle, rgba(61,78,199,0.14), transparent 65%)", animation: "hao-blob 18s ease-in-out infinite" }}
        />
        <div
          className="pointer-events-none absolute -top-32 right-[4%] h-[460px] w-[460px] rounded-full blur-[40px]"
          style={{ background: "radial-gradient(circle, rgba(117,131,234,0.11), transparent 65%)", animation: "hao-blob 22s ease-in-out infinite reverse" }}
        />
        {/* Particules */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {[
            { l: "8%", b: "24%", s: 5, d: 11, delay: 0, c: "rgba(61,78,199,0.4)" },
            { l: "22%", b: "36%", s: 4, d: 13, delay: 3, c: "rgba(117,131,234,0.35)" },
            { l: "36%", b: "18%", s: 6, d: 10, delay: 6, c: "rgba(85,99,221,0.3)" },
            { l: "55%", b: "30%", s: 4, d: 12, delay: 1.5, c: "rgba(61,78,199,0.35)" },
            { l: "68%", b: "22%", s: 5, d: 9.5, delay: 4.5, c: "rgba(117,131,234,0.4)" },
            { l: "80%", b: "38%", s: 4, d: 14, delay: 2, c: "rgba(85,99,221,0.35)" },
            { l: "90%", b: "26%", s: 6, d: 11.5, delay: 7, c: "rgba(61,78,199,0.3)" },
            { l: "46%", b: "44%", s: 3, d: 12.5, delay: 5.5, c: "rgba(117,131,234,0.3)" },
          ].map((p, i) => (
            <span
              key={i}
              className="absolute rounded-full"
              style={{
                left: p.l, bottom: p.b, width: p.s, height: p.s, background: p.c,
                animation: `hao-rise ${p.d}s linear ${p.delay}s infinite`,
              }}
            />
          ))}
        </div>

        <div className="relative mx-auto flex max-w-6xl flex-col items-center text-center">
          <div className="reveal inline-flex items-center gap-2.5 rounded-full border border-black/[0.06] bg-white/70 py-1.5 pl-2.5 pr-4 text-[13.5px] font-medium text-gray-500 shadow-sm backdrop-blur">
            <span className="rounded-full bg-[#F2A51D] px-2.5 py-0.5 text-[11.5px] font-bold text-[#3A2A00]">Marchés publics</span>
            Pensé pour les PME &amp; ETI françaises
          </div>

          <h1 className="reveal mt-8 max-w-5xl text-balance text-[40px] font-extrabold leading-[1.05] tracking-[-0.035em] md:text-7xl lg:text-[84px]" data-reveal-delay={80}>
            La plateforme qui trouve et analyse
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(100deg,#3D4EC7,#5563DD 40%,#7583EA 60%,#3D4EC7)",
                backgroundSize: "220% auto",
                animation: "hao-grad-text 7s ease-in-out infinite",
              }}
            >
              vos appels d'offres publics, puis rédige vos réponses.
            </span>
          </h1>

          <p className="reveal mt-7 max-w-2xl text-pretty text-[17px] leading-relaxed text-gray-500 md:text-[21px]" data-reveal-delay={160}>
            Gaston surveille les plateformes acheteurs, analyse chaque DCE en quelques minutes et rédige votre mémoire technique à partir de vos propres documents. Vous gardez la main — du Go / No-Go au dossier prêt à déposer.
          </p>

          <div className="reveal mt-10 flex flex-wrap justify-center gap-4" data-reveal-delay={240}>
            <Link
              to="/auth"
              className="relative inline-flex items-center gap-2.5 overflow-hidden rounded-[14px] bg-gradient-to-br from-[#3D4EC7] to-[#5563DD] px-8 py-4 text-base font-semibold text-white transition-all duration-300 hover:-translate-y-[3px]"
              style={{ boxShadow: "0 8px 24px rgba(61,78,199,0.35), inset 0 1px 0 rgba(255,255,255,0.2)" }}
            >
              <Sheen />
              Essayer la plateforme <ArrowRight className="h-[17px] w-[17px]" strokeWidth={2.2} />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2.5 rounded-[14px] border border-black/[0.09] bg-white px-8 py-4 text-base font-semibold shadow-sm transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_12px_28px_rgba(0,0,0,0.09)]"
            >
              Voir les tarifs
            </Link>
          </div>

          <p className="reveal mt-5 flex flex-wrap items-center justify-center gap-2 text-[13px] text-gray-400" data-reveal-delay={300}>
            <Check className="h-3.5 w-3.5 text-[#3D4EC7]" strokeWidth={2.4} />
            Sans engagement · Annulable à tout moment · Paiement sécurisé Stripe
          </p>

          {/* ── Mockup dashboard ── */}
          <div className="reveal relative mt-16 w-full max-w-5xl md:mt-24" data-reveal-delay={380}>
            <div
              className="pointer-events-none absolute -inset-x-16 -inset-y-10 blur-[30px]"
              style={{ background: "radial-gradient(ellipse 60% 55% at 50% 45%, rgba(61,78,199,0.13), transparent 70%)" }}
            />
            <div
              data-tilt
              className="relative overflow-hidden rounded-[20px] border border-black/[0.08] bg-white"
              style={{ boxShadow: "0 40px 100px -20px rgba(17,24,39,0.22), 0 20px 40px -20px rgba(61,78,199,0.12)" }}
            >
              {/* Barre fenêtre mac */}
              <div className="flex items-center gap-2 border-b border-black/[0.06] bg-[#F8FAFC] px-4.5 py-3.5" style={{ padding: "14px 18px" }}>
                <span className="h-3 w-3 rounded-full bg-[#FC5F57]" />
                <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
                <span className="h-3 w-3 rounded-full bg-[#28C840]" />
                <span className="mx-auto flex items-center gap-1.5 text-[12.5px] font-medium text-gray-400">
                  <Lock className="h-[11px] w-[11px]" /> app.gaston.app
                </span>
                <span className="w-[52px]" />
              </div>
              <div className="grid min-h-[420px]" style={{ gridTemplateColumns: "minmax(150px, 200px) 1fr" }}>
                {/* Sidebar */}
                <div className="flex flex-col gap-1 border-r border-black/[0.06] bg-[#FCFCFD] p-4 text-left" style={{ padding: "20px 14px" }}>
                  <div className="mb-2.5 flex items-center px-2.5 py-2">
                    <GastonLogo size={15} />
                  </div>
                  {[
                    { icon: Search, label: "Veille AO", active: true },
                    { icon: Brain, label: "Analyse IA" },
                    { icon: FileText, label: "Mémoires" },
                    { icon: ClipboardCheck, label: "Dépôts" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] ${
                        item.active ? "bg-[#3D4EC7]/[0.08] font-semibold text-[#3D4EC7]" : "font-medium text-gray-500"
                      }`}
                    >
                      <item.icon className="h-[15px] w-[15px]" strokeWidth={2} />
                      {item.label}
                    </div>
                  ))}
                </div>
                {/* Contenu */}
                <div className="flex flex-col gap-4 bg-white p-5 text-left md:p-7">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-bold tracking-tight">Veille — nouveaux marchés</div>
                      <div className="mt-0.5 text-[12.5px] text-gray-400">Atexo · Maximilien · Plateformes acheteurs</div>
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-green-600/[0.08] px-3 py-1.5 text-xs font-semibold text-green-600">
                      <span className="h-[7px] w-[7px] rounded-full bg-green-600" style={{ animation: "hao-dot 2s ease-in-out infinite" }} />
                      Veille en continu
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "AO détectés (7 j)", value: "148", accent: false },
                      { label: "Pertinents pour vous", value: "12", accent: true },
                      { label: "Mémoires en cours", value: "3", accent: false },
                    ].map((s) => (
                      <div key={s.label} className="rounded-[14px] border border-black/[0.06] bg-[#F8FAFC] px-4 py-3.5">
                        <div className="text-[11.5px] font-medium text-gray-500">{s.label}</div>
                        <div className={`mt-1 text-2xl font-extrabold tracking-tight ${s.accent ? "text-[#3D4EC7]" : ""}`}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="overflow-hidden rounded-[14px] border border-black/[0.06]">
                    {[
                      { title: "Rénovation énergétique — Région Île-de-France", sub: "DCE analysé · Dépôt le 24 juillet", badge: "score" },
                      { title: "Maintenance informatique — CHU de Nantes", sub: "Analyse IA en cours…", badge: "thinking" },
                      { title: "Fourniture de mobilier urbain — Métropole de Lyon", sub: "Nouveau · détecté il y a 12 min", badge: "new" },
                    ].map((row, i) => (
                      <div key={row.title} className={`flex items-center gap-3 px-4 py-3 ${i < 2 ? "border-b border-black/[0.05]" : ""}`}>
                        <span className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px]" style={{ background: "linear-gradient(135deg, rgba(61,78,199,0.12), rgba(117,131,234,0.12))" }}>
                          <FileText className="h-4 w-4 text-[#3D4EC7]" strokeWidth={2} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-semibold">{row.title}</div>
                          <div className="text-[11.5px] text-gray-400">{row.sub}</div>
                        </div>
                        {row.badge === "score" && (
                          <span className="whitespace-nowrap rounded-full bg-green-600/[0.08] px-2.5 py-1 text-xs font-bold text-green-600">Score 87</span>
                        )}
                        {row.badge === "thinking" && (
                          <span className="inline-flex gap-1 px-2.5 py-1">
                            {[0, 0.15, 0.3].map((d) => (
                              <span key={d} className="h-1.5 w-1.5 rounded-full bg-[#5563DD]" style={{ animation: `hao-think 1.2s ease-in-out ${d}s infinite` }} />
                            ))}
                          </span>
                        )}
                        {row.badge === "new" && (
                          <span className="whitespace-nowrap rounded-full bg-[#3D4EC7]/[0.08] px-2.5 py-1 text-xs font-bold text-[#3D4EC7]">Nouveau</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Cartes flottantes */}
            <div
              className="absolute -left-2 top-[8%] hidden items-center gap-3 rounded-2xl border border-black/[0.06] bg-white/85 px-4.5 py-3.5 backdrop-blur-xl md:flex lg:-left-8"
              style={{ boxShadow: "0 16px 40px rgba(17,24,39,0.12)", animation: "hao-float 7s ease-in-out infinite", padding: "14px 18px" }}
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-[11px] bg-gradient-to-br from-[#3D4EC7] to-[#5563DD] shadow-[0_6px_14px_rgba(61,78,199,0.35)]">
                <Brain className="h-[17px] w-[17px] text-white" strokeWidth={2} />
              </span>
              <div className="text-left">
                <div className="text-[13px] font-bold">Analyse IA terminée</div>
                <div className="text-xs text-gray-500">Score de pertinence : 87/100</div>
              </div>
            </div>
            <div
              className="absolute -right-2 bottom-[14%] hidden items-center gap-3 rounded-2xl border border-black/[0.06] bg-white/85 backdrop-blur-xl md:flex lg:-right-8"
              style={{ boxShadow: "0 16px 40px rgba(17,24,39,0.12)", animation: "hao-float-b 8s ease-in-out 1s infinite", padding: "14px 18px" }}
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-[11px] bg-gradient-to-br from-[#5563DD] to-[#7583EA] shadow-[0_6px_14px_rgba(117,131,234,0.35)]">
                <Download className="h-[17px] w-[17px] text-white" strokeWidth={2} />
              </span>
              <div className="text-left">
                <div className="text-[13px] font-bold">Mémoire technique exporté</div>
                <div className="text-xs text-gray-500">PDF prêt à déposer · 42 pages</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════ BÉNÉFICES ═════════ */}
      <section className="border-y border-black/[0.05] bg-[#F8FAFC] px-5 py-20 md:px-12 md:py-36">
        <div className="mx-auto max-w-6xl">
          <div className="reveal mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-3xl font-extrabold leading-[1.12] tracking-tight md:text-5xl">Répondez mieux, pour gagner plus.</h2>
            <p className="mt-5 text-base leading-relaxed text-gray-500 md:text-lg">
              Vous le savez : la commande publique est une mine d'or… qui demande trop de temps. Gaston simplifie et optimise chaque réponse.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:mt-18 md:grid-cols-3" style={{ marginTop: "clamp(48px, 6vw, 72px)" }}>
            {[
              { title: "8× plus rapide", grad: "linear-gradient(100deg,#3D4EC7,#5563DD)", text: "De l'analyse du DCE à la rédaction du mémoire, Gaston automatise toutes les tâches répétitives.", delay: 0 },
              { title: "+30 % de réussite", grad: "linear-gradient(100deg,#5563DD,#7583EA)", text: "Des mémoires précis et personnalisés pour vous démarquer de la concurrence sur la note technique.", delay: 100 },
              { title: "0 opportunité ratée", grad: "linear-gradient(100deg,#3D4EC7,#7583EA)", text: "Une veille continue sur les principales plateformes acheteurs, filtrée sur votre profil entreprise.", delay: 200 },
            ].map((b) => (
              <div
                key={b.title}
                className="reveal rounded-3xl border border-black/[0.06] bg-white p-8 shadow-[0_2px_8px_rgba(17,24,39,0.04)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_48px_-12px_rgba(17,24,39,0.12)]"
                data-reveal-delay={b.delay}
                style={{ transitionTimingFunction: EASE }}
              >
                <div className="bg-clip-text text-3xl font-extrabold tracking-tight text-transparent md:text-4xl" style={{ backgroundImage: b.grad }}>
                  {b.title}
                </div>
                <p className="mt-3.5 text-[15px] leading-relaxed text-gray-500">{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════ FONCTIONNALITÉS (3 blocs alternés) ═════════ */}
      <section id="fonctionnalites" className="relative overflow-hidden px-5 py-20 md:px-12 md:py-36">
        <div className="mx-auto flex max-w-6xl flex-col gap-24 md:gap-40">
          <div className="reveal mx-auto max-w-3xl text-center">
            <div className="eyebrow mb-4">La solution</div>
            <h2 className="text-balance text-3xl font-extrabold leading-[1.12] tracking-tight md:text-5xl">Un seul outil, du sourcing au dépôt.</h2>
            <p className="mt-5 text-base leading-relaxed text-gray-500 md:text-lg">Pensé avec des consultants AO et des PME qui répondent au quotidien.</p>
          </div>

          {/* 01 · Veille */}
          <div className="grid items-center gap-10 md:grid-cols-2 md:gap-18" style={{ gap: "clamp(36px, 5vw, 72px)" }}>
            <div className="reveal reveal-left">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#3D4EC7]/[0.08] px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-[#3D4EC7]">01 · Veille intelligente</div>
              <h3 className="mt-5 text-balance text-2xl font-extrabold leading-[1.15] tracking-tight md:text-[38px]">Détectez chaque marché pertinent, automatiquement.</h3>
              <p className="mt-3.5 mb-6 leading-relaxed text-gray-500">
                Surveillance en continu des principales plateformes acheteurs publiques. Alertes filtrées sur votre profil entreprise — plus aucune opportunité noyée dans le bruit.
              </p>
              <div className="flex flex-col gap-3">
                <CheckRow>Atexo, Marchés-Sécurisés, Maximilien, AWS-Achat et bien d'autres</CheckRow>
                <CheckRow>Filtres intelligents par profil entreprise</CheckRow>
                <CheckRow>Alertes email illimitées, en temps réel</CheckRow>
              </div>
            </div>
            <div className="reveal reveal-right relative">
              <div className="pointer-events-none absolute -inset-8 blur-[24px]" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(61,78,199,0.1), transparent 70%)" }} />
              <div data-tilt className="relative rounded-[20px] border border-black/[0.07] bg-white p-5 text-left shadow-[0_30px_70px_-18px_rgba(17,24,39,0.18)]">
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-sm font-bold">Nouveaux marchés détectés</div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-green-600/[0.08] px-2.5 py-1 text-[11.5px] font-semibold text-green-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-600" style={{ animation: "hao-dot 2s ease-in-out infinite" }} />
                    Live
                  </div>
                </div>
                <div className="flex flex-col gap-2.5">
                  {[
                    { t: "Travaux de voirie — Ville de Bordeaux", s: "Atexo · il y a 4 min", m: "92 % match", c: "text-green-600 bg-green-600/10" },
                    { t: "Prestations de nettoyage — CD 44", s: "Maximilien · il y a 18 min", m: "78 % match", c: "text-[#3D4EC7] bg-[#3D4EC7]/[0.08]" },
                    { t: "Refonte SI RH — Métropole de Lille", s: "AWS-Achat · il y a 1 h", m: "64 % match", c: "text-gray-500 bg-gray-100" },
                  ].map((r) => (
                    <div key={r.t} className="flex items-center gap-3 rounded-[13px] border border-black/[0.06] bg-[#F8FAFC] px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold">{r.t}</div>
                        <div className="text-[11.5px] text-gray-400">{r.s}</div>
                      </div>
                      <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-bold ${r.c}`}>{r.m}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 02 · Analyse IA (inversé) */}
          <div className="grid items-center gap-10 md:grid-cols-2" style={{ gap: "clamp(36px, 5vw, 72px)" }}>
            <div className="reveal reveal-left relative order-2 md:order-1">
              <div className="pointer-events-none absolute -inset-8 blur-[24px]" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(85,99,221,0.1), transparent 70%)" }} />
              <div data-tilt className="relative rounded-[20px] border border-black/[0.07] bg-white p-5 text-left shadow-[0_30px_70px_-18px_rgba(17,24,39,0.18)]">
                <div className="mb-4 flex items-center gap-3.5">
                  <div className="relative h-[82px] w-[82px] shrink-0">
                    <svg width="82" height="82" viewBox="0 0 82 82">
                      <circle cx="41" cy="41" r="36" fill="none" stroke="#EEF2F7" strokeWidth="8" />
                      <circle
                        cx="41" cy="41" r="36" fill="none" stroke="url(#haoGrad)" strokeWidth="8" strokeLinecap="round"
                        strokeDasharray="226" strokeDashoffset="29" transform="rotate(-90 41 41)"
                        style={{ animation: "hao-ring 1.6s cubic-bezier(0.22,1,0.36,1)" }}
                      />
                      <defs>
                        <linearGradient id="haoGrad" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#3D4EC7" />
                          <stop offset="100%" stopColor="#7583EA" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-[19px] font-extrabold">87</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold">Go / No-Go — Score de pertinence</div>
                    <div className="mt-0.5 text-xs text-gray-400">Rénovation énergétique · Région IDF</div>
                    <span className="mt-2 inline-flex rounded-full bg-green-600/10 px-3 py-1 text-[11.5px] font-bold text-green-600">Recommandation : GO</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {[
                    { icon: AlertTriangle, color: "text-amber-500", text: "Point de vigilance : pénalités de retard renforcées (art. 8.2 du CCAP)" },
                    { icon: FileText, color: "text-[#3D4EC7]", text: "Note technique : 60 % — mémoire environnemental exigé" },
                    { icon: Check, color: "text-green-600", text: "Plan de réponse généré : 6 sections, prêt à rédiger" },
                  ].map((r) => (
                    <div key={r.text} className="flex items-start gap-2.5 rounded-xl border border-black/[0.06] bg-[#F8FAFC] px-3.5 py-2.5 text-[13px] text-gray-700">
                      <r.icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${r.color}`} strokeWidth={2.2} />
                      {r.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="reveal reveal-right order-1 md:order-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#5563DD]/[0.08] px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-[#5563DD]">02 · Analyse IA</div>
              <h3 className="mt-5 text-balance text-2xl font-extrabold leading-[1.15] tracking-tight md:text-[38px]">Analysez chaque DCE en quelques minutes.</h3>
              <p className="mt-3.5 mb-6 leading-relaxed text-gray-500">
                Notre IA décortique le DCE et produit un score de pertinence, des points de vigilance et un plan de réponse. Structurez vos décisions Go / No-Go.
              </p>
              <div className="flex flex-col gap-3">
                <CheckRow from="#5563DD" to="#6D28D9">Scoring de pertinence sur votre profil</CheckRow>
                <CheckRow from="#5563DD" to="#6D28D9">Enjeux, risques et points de vigilance identifiés</CheckRow>
                <CheckRow from="#5563DD" to="#6D28D9">Plan de réponse structuré, partageable en interne</CheckRow>
              </div>
            </div>
          </div>

          {/* 03 · Rédaction */}
          <div className="grid items-center gap-10 md:grid-cols-2" style={{ gap: "clamp(36px, 5vw, 72px)" }}>
            <div className="reveal reveal-left">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#7583EA]/[0.08] px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-[#7583EA]">03 · Rédaction &amp; dépôt</div>
              <h3 className="mt-5 text-balance text-2xl font-extrabold leading-[1.15] tracking-tight md:text-[38px]">Des mémoires techniques ultra-personnalisés.</h3>
              <p className="mt-3.5 mb-6 leading-relaxed text-gray-500">
                Mémoire technique généré à partir de vos documents d'entreprise (références, moyens, certifications, méthodes) — pas de copier-coller, pas de contenu générique. Exporté en PDF ou PPTX, prêt à déposer.
              </p>
              <div className="flex flex-col gap-3">
                <CheckRow from="#6D28D9" to="#7583EA">Rédigé depuis vos documents d'entreprise</CheckRow>
                <CheckRow from="#6D28D9" to="#7583EA">Structuré selon les exigences du règlement de consultation</CheckRow>
                <CheckRow from="#6D28D9" to="#7583EA">Export PDF / PPTX en un clic</CheckRow>
              </div>
            </div>
            <div className="reveal reveal-right relative">
              <div className="pointer-events-none absolute -inset-8 blur-[24px]" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(117,131,234,0.1), transparent 70%)" }} />
              <div data-tilt className="relative rounded-[20px] border border-black/[0.07] bg-white p-6 text-left shadow-[0_30px_70px_-18px_rgba(17,24,39,0.18)]">
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-sm font-bold">Mémoire technique — v3</div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#7583EA]/[0.08] px-2.5 py-1 text-[11.5px] font-bold text-[#7583EA]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#7583EA]" style={{ animation: "hao-think 1.2s ease-in-out infinite" }} />
                    IA en cours de rédaction
                  </span>
                </div>
                <div className="mb-2.5 text-[13.5px] font-bold">2. Méthodologie d'intervention</div>
                <div className="flex flex-col gap-2">
                  <div className="h-[11px] w-full rounded-md bg-[#EEF2F7]" />
                  <div className="h-[11px] w-[94%] rounded-md bg-[#EEF2F7]" />
                  <div className="h-[11px] w-[97%] rounded-md bg-[#EEF2F7]" />
                  <div
                    className="h-[11px] w-[62%] rounded-md"
                    style={{ background: "linear-gradient(90deg,#DBE0FB,#FDEBC8,#DBE0FB)", backgroundSize: "200% 100%", animation: "hao-shimmer 1.8s linear infinite" }}
                  />
                </div>
                <div className="mt-5 flex flex-wrap gap-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-[10px] border border-black/[0.08] bg-[#F8FAFC] px-3.5 py-2 text-[12.5px] font-semibold">
                    <FileText className="h-[13px] w-[13px] text-red-600" strokeWidth={2} /> Export PDF
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-[10px] border border-black/[0.08] bg-[#F8FAFC] px-3.5 py-2 text-[12.5px] font-semibold">
                    <FileText className="h-[13px] w-[13px] text-orange-600" strokeWidth={2} /> Export PPTX
                  </span>
                  <span className="inline-flex items-center rounded-[10px] bg-gradient-to-br from-[#3D4EC7] to-[#5563DD] px-4 py-2 text-[12.5px] font-bold text-white shadow-[0_6px_14px_rgba(61,78,199,0.3)]">Déposer</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════ SÉCURITÉ ═════════ */}
      <section id="securite" className="relative overflow-hidden bg-[#0B1220] py-20 md:py-36">
        <div className="pointer-events-none absolute -top-40 left-[20%] h-[520px] w-[520px] rounded-full blur-[50px]" style={{ background: "radial-gradient(circle, rgba(61,78,199,0.25), transparent 65%)", animation: "hao-blob 18s ease-in-out infinite" }} />
        <div className="pointer-events-none absolute -bottom-52 right-[12%] h-[480px] w-[480px] rounded-full blur-[50px]" style={{ background: "radial-gradient(circle, rgba(117,131,234,0.2), transparent 65%)", animation: "hao-blob 22s ease-in-out infinite reverse" }} />
        <div className="bg-grid-dark pointer-events-none absolute inset-0" />

        <div className="relative mx-auto max-w-6xl px-5 md:px-12">
          <div className="reveal mx-auto max-w-3xl text-center">
            <div className="mb-4 text-[13px] font-bold uppercase tracking-[0.1em] text-indigo-400">Sécurité &amp; infrastructure</div>
            <h2 className="text-balance text-3xl font-extrabold leading-[1.12] tracking-tight text-white md:text-5xl">Une infrastructure IA que votre DSI validera.</h2>
            <p className="mt-5 text-base leading-relaxed text-white/60 md:text-lg">Sécurité, souveraineté et fiabilité — sans compromis.</p>
          </div>
        </div>

        {/* Marquee badges */}
        <div className="reveal mt-12 overflow-hidden md:mt-16" style={{ maskImage: "linear-gradient(90deg, transparent, black 12%, black 88%, transparent)" }}>
          <div className="flex w-max gap-4" style={{ animation: "hao-marquee 26s linear infinite" }}>
            {[...Array(2)].flatMap((_, dup) =>
              [
                { icon: Globe, label: "Hébergement UE" },
                { icon: Shield, label: "Conforme RGPD" },
                { icon: Lock, label: "Chiffrement AES-256" },
                { icon: Users, label: "Données isolées par client" },
                { icon: ShieldCheck, label: "Aucun entraînement sur vos données" },
              ].map((b) => (
                <span
                  key={`${dup}-${b.label}`}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-white/[0.12] bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/85 backdrop-blur"
                >
                  <b.icon className="h-[15px] w-[15px] text-indigo-400" strokeWidth={2} />
                  {b.label}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Diagramme + cartes */}
        <div className="relative mx-auto mt-14 grid max-w-6xl items-center gap-10 px-5 md:mt-22 md:grid-cols-2 md:px-12" style={{ gap: "clamp(36px, 5vw, 72px)" }}>
          <div className="reveal reveal-left flex flex-col items-center">
            {[
              { title: "Application Gaston", sub: "Veille · Analyse & Go / No-Go · Chiffrage · Mémoires techniques", highlight: false },
              { title: "Architecture IA & RAG", sub: "Moteur IA sécurisé · Réponses générées à partir de vos données d'entreprise · Sources tracées", highlight: true },
              { title: "Vos données", sub: "Cloud européen sécurisé · chiffrées au repos et en transit", highlight: false },
            ].map((block, i) => (
              <div key={block.title} className="contents">
                {i > 0 && (
                  <svg width="24" height="44" viewBox="0 0 24 44" className="block">
                    <line x1="12" y1="0" x2="12" y2="44" stroke="rgba(139,151,241,0.6)" strokeWidth="2" strokeDasharray="5 5" style={{ animation: "hao-dash 1.2s linear infinite" }} />
                  </svg>
                )}
                <div
                  className={`w-full max-w-md rounded-[18px] border px-6 py-5 text-center backdrop-blur ${
                    block.highlight ? "border-indigo-400/30 bg-[#3D4EC7]/[0.12]" : "border-white/[0.12] bg-white/[0.06]"
                  }`}
                  style={block.highlight ? { animation: "hao-glow-pulse 4.5s ease-in-out infinite" } : undefined}
                >
                  <div className="text-[15px] font-bold text-white">{block.title}</div>
                  <div className="mt-1 text-[12.5px] text-white/55">{block.sub}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="reveal reveal-right grid gap-4 sm:grid-cols-2">
            {[
              { t: "Architecture IA", d: "Une IA qui s'appuie exclusivement sur vos documents, sans jamais s'entraîner dessus. Traçabilité complète des sources." },
              { t: "Sécurité & conformité", d: "Hébergement européen, chiffrement complet, conformité RGPD native." },
              { t: "Plateforme SaaS", d: "Déploiement rapide, haute disponibilité, mises à jour continues. Zéro maintenance." },
              { t: "Accompagnement humain", d: "Des experts AO qui répondent eux-mêmes à des marchés, disponibles à la demande." },
            ].map((c) => (
              <div key={c.t} className="rounded-[18px] border border-white/10 bg-white/5 px-5 py-6 transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.09]">
                <div className="text-[15px] font-bold text-white">{c.t}</div>
                <p className="mt-2 text-[13px] leading-relaxed text-white/55">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════ TARIFS ═════════ */}
      <section id="tarifs" className="relative overflow-hidden px-5 py-20 md:px-12 md:py-36">
        <div className="relative mx-auto max-w-6xl">
          <div className="reveal mx-auto max-w-2xl text-center">
            <div className="eyebrow mb-4">Tarifs</div>
            <h2 className="text-balance text-3xl font-extrabold leading-[1.12] tracking-tight md:text-5xl">Surveillez, rédigez ou déléguez.</h2>
            <p className="mt-5 text-base leading-relaxed text-gray-500 md:text-lg">
              Trois offres indépendantes, cumulables librement. Un prix clair pour chacune, sans engagement.
            </p>
          </div>

          <div className="reveal mt-14 grid gap-5 md:grid-cols-3">
            {/* Offre 1 — Veille */}
            <div className="flex flex-col rounded-3xl border border-black/[0.06] bg-white p-8 shadow-[0_2px_8px_rgba(17,24,39,0.04)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_48px_-12px_rgba(17,24,39,0.12)]">
              <div className="text-[11.5px] font-bold uppercase tracking-wider text-[#3D4EC7]">Abonnement mensuel</div>
              <div className="mt-2 text-xl font-extrabold tracking-tight">{sourcing.name}</div>
              <div className="mt-1 text-[13.5px] leading-normal text-gray-500">{sourcing.description}</div>
              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="whitespace-nowrap text-[38px] font-extrabold tracking-tight">{sourcing.monthlyAmountEur}&nbsp;€</span>
                <span className="text-sm text-gray-400">/mois</span>
              </div>
              <div className="my-6 flex flex-1 flex-col gap-2.5">
                {sourcing.features.map((f) => (
                  <div key={f} className="flex items-start gap-2.5 text-sm text-gray-700">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#3D4EC7]" strokeWidth={2.5} /> {f}
                  </div>
                ))}
              </div>
              <Link
                to="/pricing"
                className="block rounded-xl border border-black/10 bg-white py-3 text-center text-[15px] font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(0,0,0,0.08)]"
              >
                Choisir cette offre
              </Link>
              <p className="mt-3 text-center text-xs text-gray-400">
                Option : + {sourcingOption.monthlyAmountEur}&nbsp;€/mois par destinataire d'alertes supplémentaire
              </p>
            </div>

            {/* Offre 2 — Assistant IA (recommandée) */}
            <div
              className="relative flex flex-col rounded-3xl p-8 shadow-[0_24px_56px_-16px_rgba(61,78,199,0.28)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_34px_68px_-16px_rgba(61,78,199,0.38)]"
              style={{
                background: "linear-gradient(#FFFFFF,#FFFFFF) padding-box, linear-gradient(135deg,#3D4EC7,#5563DD,#7583EA) border-box",
                border: "2px solid transparent",
              }}
            >
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#F2A51D] px-4 py-1.5 text-[11.5px] font-bold uppercase tracking-wide text-[#3A2A00] shadow-[0_6px_16px_rgba(242,165,29,0.4)]">
                Recommandé
              </div>
              <div className="text-[11.5px] font-bold uppercase tracking-wider text-[#5563DD]">Abonnement mensuel</div>
              <div className="mt-2 text-xl font-extrabold tracking-tight">Assistant IA</div>
              <div className="mt-1 text-[13.5px] leading-normal text-gray-500">Analysez et rédigez vos réponses 8× plus vite.</div>
              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="text-sm font-semibold text-gray-400">dès</span>
                <span className="whitespace-nowrap text-[38px] font-extrabold tracking-tight">
                  {Math.min(...assistantPlans.map((p) => p.monthlyAmountEur))}&nbsp;€
                </span>
                <span className="text-sm text-gray-400">/mois</span>
              </div>
              <div className="mt-4 overflow-hidden rounded-[14px] border border-black/[0.06]">
                {assistantPlans.map((p, i) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${
                      i < assistantPlans.length - 1 ? "border-b border-black/[0.05]" : ""
                    } ${p.highlight ? "bg-[#3D4EC7]/[0.06] font-semibold" : "bg-[#F8FAFC]"}`}
                  >
                    <span>
                      {p.aoPerMonth} AO traité{(p.aoPerMonth ?? 0) > 1 ? "s" : ""} /mois
                      {p.id === "assistant_business" && " · support prioritaire"}
                    </span>
                    <span className="whitespace-nowrap font-bold">{p.monthlyAmountEur}&nbsp;€</span>
                  </div>
                ))}
              </div>
              <div className="my-6 flex flex-1 flex-col gap-2.5">
                {ASSISTANT_FEATURES.map((f) => (
                  <div key={f} className="flex items-start gap-2.5 text-sm text-gray-700">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#3D4EC7]" strokeWidth={2.5} /> {f}
                  </div>
                ))}
              </div>
              <Link
                to="/pricing"
                className="relative block overflow-hidden rounded-xl bg-gradient-to-br from-[#3D4EC7] to-[#5563DD] py-3 text-center text-[15px] font-semibold text-white transition-all duration-300 hover:-translate-y-0.5"
                style={{ boxShadow: "0 8px 20px rgba(61,78,199,0.35), inset 0 1px 0 rgba(255,255,255,0.2)" }}
              >
                <Sheen />
                Choisir cette offre
              </Link>
              <p className="mt-3 text-center text-xs text-gray-400">Se combine avec l'offre Veille.</p>
            </div>

            {/* Offre 3 — Chef de projet AO */}
            <div className="flex flex-col rounded-3xl border border-black/[0.06] bg-white p-8 shadow-[0_2px_8px_rgba(17,24,39,0.04)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_48px_-12px_rgba(17,24,39,0.12)]">
              <div className="text-[11.5px] font-bold uppercase tracking-wider text-[#7583EA]">Forfait + commission au succès</div>
              <div className="mt-2 text-xl font-extrabold tracking-tight">Chef de projet AO</div>
              <div className="mt-1 text-[13.5px] leading-normal text-gray-500">Un expert répond à votre place, de A à Z.</div>
              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="text-sm font-semibold text-gray-400">dès</span>
                <span className="whitespace-nowrap text-[38px] font-extrabold tracking-tight">
                  {Math.min(...expertPlans.map((p) => p.monthlyAmountEur))}&nbsp;€
                </span>
                <span className="text-sm text-gray-400">par dossier</span>
              </div>
              <div className="mt-4 overflow-hidden rounded-[14px] border border-black/[0.06]">
                {expertPlans.map((p, i) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${
                      i < expertPlans.length - 1 ? "border-b border-black/[0.05]" : ""
                    } bg-[#F8FAFC]`}
                  >
                    <span>{p.name}</span>
                    <span className="whitespace-nowrap text-right font-bold">
                      {p.monthlyAmountEur.toLocaleString("fr-FR")}&nbsp;€ + {p.successFeeLabel}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[12.5px] font-medium text-gray-500">Le pourcentage n'est dû que si vous remportez le marché.</p>
              <div className="my-6 flex flex-1 flex-col gap-2.5">
                {EXPERT_FEATURES.map((f) => (
                  <div key={f} className="flex items-start gap-2.5 text-sm text-gray-700">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#3D4EC7]" strokeWidth={2.5} /> {f}
                  </div>
                ))}
              </div>
              <a
                href="mailto:contact@gaston.app?subject=Accompagnement%20AO"
                className="block rounded-xl border border-black/10 bg-white py-3 text-center text-[15px] font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(0,0,0,0.08)]"
              >
                Demander un devis
              </a>
            </div>
          </div>

          <p className="reveal mt-8 text-center text-[13px] text-gray-400">{PRICING_FOOTNOTE}</p>
        </div>
      </section>

      {/* ═════════ CHIFFRES ═════════ */}
      <section className="border-y border-black/[0.05] bg-[#F8FAFC] px-5 py-20 md:px-12 md:py-32">
        <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2" style={{ gap: "clamp(36px, 5vw, 72px)" }}>
          <div className="reveal reveal-left">
            <div className="eyebrow mb-4">Les chiffres parlent d'eux-mêmes</div>
            <h2 className="text-balance text-[28px] font-extrabold leading-[1.15] tracking-tight md:text-[46px]">Votre temps est précieux. Passez-le là où ça compte.</h2>
            <p className="mt-5 text-pretty leading-relaxed text-gray-500 md:text-lg">
              Avec Gaston, votre équipe se concentre sur l'essentiel : la stratégie, l'offre et le prix. L'IA s'occupe du reste.
            </p>
          </div>
          <div className="reveal reveal-right grid grid-cols-3 gap-4 text-center">
            {[
              { count: 7, suffix: " h", label: "gagnées par AO", grad: "linear-gradient(100deg,#3D4EC7,#5563DD)", prefix: "" },
              { count: 30, suffix: " %", label: "de taux de réussite", grad: "linear-gradient(100deg,#5563DD,#7583EA)", prefix: "+" },
              { count: 22000, suffix: "+", label: "AO surveillés", grad: "linear-gradient(100deg,#3D4EC7,#7583EA)", prefix: "" },
            ].map((s) => (
              <div key={s.label} className="rounded-[20px] border border-black/[0.06] bg-white px-3 py-6 shadow-[0_2px_8px_rgba(17,24,39,0.04)] md:py-8">
                <div className="bg-clip-text text-[28px] font-extrabold tracking-tight text-transparent md:text-[42px]" style={{ backgroundImage: s.grad }}>
                  {s.prefix}
                  <span data-count={s.count}>0</span>
                  {s.suffix}
                </div>
                <div className="mt-1.5 text-[13px] leading-snug text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════ FAQ ═════════ */}
      <section id="faq" className="px-5 py-20 md:px-12 md:py-36">
        <div className="mx-auto max-w-3xl">
          <div className="reveal text-center">
            <div className="eyebrow mb-4">FAQ</div>
            <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl">Questions fréquentes</h2>
          </div>
          <div className="reveal mt-10 flex flex-col gap-3.5 md:mt-14" data-reveal-delay={100}>
            {[
              { q: "Y a-t-il un engagement ?", r: "Non. Tous les abonnements sont mensuels et annulables à tout moment depuis le portail Stripe." },
              { q: "Les offres sont-elles cumulables ?", r: "Oui. Veille, Assistant IA et Chef de projet AO sont trois offres indépendantes, que vous combinez librement. Vous pouvez par exemple commencer par la Veille seule, puis ajouter l'Assistant IA quand un marché vous intéresse." },
              { q: "Qu'est-ce qu'un « AO traité » ?", r: "Chaque appel d'offres pour lequel vous lancez l'analyse du DCE et la rédaction du mémoire technique compte pour un AO traité. Les paliers de l'Assistant IA incluent 1, 3 ou 10 AO traités par mois." },
              { q: "Quelles plateformes surveillez-vous ?", r: "Les principales plateformes acheteurs publiques françaises (Atexo, Marchés-Sécurisés, Maximilien, AWS-Achat, etc.). La veille tourne en continu et de nouvelles sources sont ajoutées chaque mois." },
              { q: "Mes données restent-elles confidentielles ?", r: "Oui. Vos données sont hébergées en Europe, chiffrées et strictement cloisonnées par client. Elles ne servent jamais à entraîner des modèles d'IA." },
              { q: "L'IA est-elle vraiment fiable pour un mémoire technique ?", r: "L'IA produit un premier jet structuré à partir de vos documents d'entreprise. Vous gardez la main éditoriale : chaque section peut être relue et modifiée avant export. C'est un accélérateur, pas un automate." },
              { q: "Quelle différence avec l'offre Chef de projet AO ?", r: "Avec l'Assistant IA, vous pilotez vous-même la réponse. Avec le Chef de projet AO, un expert humain prend le dossier en charge de A à Z, avec une commission due uniquement si vous remportez le marché." },
            ].map((f, i) => (
              <details
                key={f.q}
                open={i === 0}
                className="group overflow-hidden rounded-[18px] border border-black/[0.07] bg-white transition-shadow duration-300 hover:shadow-[0_8px_24px_rgba(17,24,39,0.06)]"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-left text-[16.5px] font-semibold tracking-tight [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-all duration-300 group-open:rotate-180 group-open:bg-gradient-to-br group-open:from-[#3D4EC7] group-open:to-[#5563DD] group-open:text-white">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </span>
                </summary>
                <p className="px-6 pb-6 text-[15px] leading-relaxed text-gray-500">{f.r}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════ CTA FINAL ═════════ */}
      <section id="contact" className="px-5 pb-24 pt-10 md:px-12 md:pb-36 md:pt-20">
        <div className="reveal relative mx-auto max-w-6xl overflow-hidden rounded-[32px] bg-[#111827] px-7 py-16 text-center md:px-20 md:py-28">
          <div className="pointer-events-none absolute -top-40 left-[15%] h-[480px] w-[480px] rounded-full blur-[50px]" style={{ background: "radial-gradient(circle, rgba(61,78,199,0.4), transparent 65%)", animation: "hao-blob 16s ease-in-out infinite" }} />
          <div className="pointer-events-none absolute -bottom-44 right-[10%] h-[460px] w-[460px] rounded-full blur-[50px]" style={{ background: "radial-gradient(circle, rgba(117,131,234,0.35), transparent 65%)", animation: "hao-blob 20s ease-in-out infinite reverse" }} />
          <div className="relative">
            <h2 className="text-balance text-3xl font-extrabold leading-[1.1] tracking-tight text-white md:text-[56px]">Prêt à gagner plus de marchés&nbsp;?</h2>
            <p className="mx-auto mt-5 max-w-xl text-pretty leading-relaxed text-white/65 md:text-xl">
              Commencez par la Veille à 99&nbsp;€ HT/mois. Ajoutez l'Assistant IA ou le Chef de projet AO quand vous êtes prêt.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2.5 rounded-[14px] bg-white px-9 py-4 text-base font-semibold text-[#111827] shadow-[0_8px_24px_rgba(0,0,0,0.3)] transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_16px_40px_rgba(0,0,0,0.4)]"
              >
                Voir les tarifs <ArrowRight className="h-[17px] w-[17px]" strokeWidth={2.2} />
              </Link>
              <a
                href="mailto:contact@gaston.app"
                className="inline-flex items-center gap-2.5 rounded-[14px] border border-white/15 bg-white/[0.08] px-9 py-4 text-base font-semibold text-white backdrop-blur transition-all duration-300 hover:-translate-y-[3px] hover:bg-white/[0.14]"
              >
                Parler à un expert
              </a>
            </div>
            <p className="mt-6 text-[13px] text-white/45">Sans engagement · Annulable à tout moment · Paiement sécurisé Stripe</p>
          </div>
        </div>
      </section>

      {/* ═════════ FOOTER ═════════ */}
      <footer className="border-t border-black/[0.06] px-5 py-12 md:px-12">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6">
          <div className="flex items-center">
            <GastonLogo size={22} />
          </div>
          <div className="flex flex-wrap gap-7 text-[13.5px] text-gray-500">
            <a href="#fonctionnalites" className="transition-colors hover:text-[#111827]">Fonctionnalités</a>
            <a href="#securite" className="transition-colors hover:text-[#111827]">Sécurité</a>
            <a href="#tarifs" className="transition-colors hover:text-[#111827]">Tarifs</a>
            <a href="#faq" className="transition-colors hover:text-[#111827]">FAQ</a>
            <Link to="/auth" className="transition-colors hover:text-[#111827]">Connexion</Link>
          </div>
          <div className="text-[13px] text-gray-400">© {new Date().getFullYear()} Gaston · Données hébergées en Europe · RGPD</div>
        </div>
      </footer>
    </main>
  );
};

export default Index;
