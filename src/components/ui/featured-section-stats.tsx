"use client";

import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
} from "recharts";

const stats = [
  { value: "+10 ans", label: "d'expérience dans le pilotage d'appels d'offres complexes" },
  { value: "+100", label: "appels d'offres rendus par an" },
  { value: "+48%", label: "de taux de gain" },
  { value: "+400M€", label: "gagnés pour nos clients" },
];

const data = [
  { name: "Jan", value: 20 },
  { name: "Fév", value: 35 },
  { name: "Mar", value: 50 },
  { name: "Avr", value: 65 },
  { name: "Mai", value: 80 },
  { name: "Jun", value: 100 },
  { name: "Jul", value: 130 },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 100, damping: 15 },
  },
};

export default function FeaturedSectionStats() {
  const { ref, isVisible } = useScrollAnimation({ threshold: 0.2 });

  return (
    <section className="relative py-16 md:py-20 bg-charcoal overflow-hidden">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorValueBg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#colorValueBg)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div ref={ref} className="section-container relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mb-10"
        >
          <span className="text-primary font-medium uppercase tracking-wider text-sm mb-4 block">
            Nos résultats
          </span>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground leading-tight">
            Des performances qui{" "}
            <span className="text-gradient-orange">font la différence.</span>
          </h2>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isVisible ? 'visible' : 'hidden'}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6"
        >
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="group relative p-5 rounded-2xl bg-background/10 backdrop-blur-sm border border-white/10 hover:border-primary/30 transition-all duration-300"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
              <p className="relative text-2xl md:text-3xl lg:text-4xl font-display font-bold text-gradient-orange mb-2">
                {stat.value}
              </p>
              <p className="relative text-muted-foreground text-xs md:text-sm leading-relaxed">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
