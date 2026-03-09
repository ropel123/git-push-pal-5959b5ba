"use client";
import React from "react";
import { Mail, Phone, MapPin, Linkedin, Calendar } from "lucide-react";
import { FooterBackgroundGradient, TextHoverEffect } from "@/components/ui/hover-footer";
import { Link } from "react-router-dom";

const services = [
  { label: "Sourcing d'appels d'offres", description: "Veille quotidienne et identification des marchés publics" },
  { label: "Bid Management & PMO", description: "Pilotage et coordination des réponses aux appels d'offres" },
  { label: "Design & Impact", description: "Conception graphique de propositions commerciales" },
  { label: "Knowledge Management", description: "Capitalisation et templates de réponses" },
  { label: "Hackademy", description: "Formation aux appels d'offres et marchés publics" },
];

const expertise = [
  "Marchés publics",
  "Appels d'offres",
  "Mémoire technique",
  "DUME",
  "DC1 DC2",
  "BPU DQE",
];

const contactInfo = {
  email: "contact@hackify.fr",
  phone: "+33 1 23 45 67 89",
  address: "Paris, France",
  calendly: "https://calendly.com/hackifyao",
  linkedin: "https://linkedin.com/company/hackify",
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  "name": "HACKIFY",
  "description": "Cabinet de conseil spécialisé dans l'accompagnement aux appels d'offres et marchés publics. Sourcing, bid management, design de propositions commerciales et formation.",
  "url": "https://www.hackify.fr",
  "logo": "https://www.hackify.fr/logo.png",
  "image": "https://www.hackify.fr/og-image.jpg",
  "telephone": contactInfo.phone,
  "email": contactInfo.email,
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Paris",
    "addressCountry": "FR"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "48.8566",
    "longitude": "2.3522"
  },
  "areaServed": {
    "@type": "Country",
    "name": "France"
  },
  "serviceType": [
    "Conseil en appels d'offres",
    "Sourcing de marchés publics",
    "Rédaction de mémoires techniques",
    "Formation aux appels d'offres",
    "Design de propositions commerciales"
  ],
  "knowsAbout": [
    "Marchés publics français",
    "Code de la commande publique",
    "Appels d'offres B2B",
    "Mémoire technique",
    "DUME",
    "Acheteurs publics"
  ],
  "sameAs": [
    contactInfo.linkedin
  ],
  "priceRange": "€€€",
  "openingHoursSpecification": {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "opens": "09:00",
    "closes": "18:00"
  }
};

function HoverFooter() {
  return (
    <footer
      className="relative w-full bg-background border-t border-border/50 overflow-hidden"
      role="contentinfo"
      aria-label="Pied de page HACKIFY - Cabinet de conseil en appels d'offres"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <FooterBackgroundGradient />

      <div className="relative z-10">
        <div className="section-container py-12 lg:py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            <div className="lg:col-span-1">
              <Link to="/" className="inline-flex items-center gap-2 mb-4" aria-label="HACKIFY - Accueil">
                <span className="text-2xl font-display font-bold text-foreground">
                  HACK<span className="text-primary">IFY</span>
                </span>
              </Link>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                <strong>Cabinet de conseil spécialisé en appels d'offres</strong> à Paris.
                Nous accompagnons les ETI et grands groupes dans le sourcing, la rédaction
                de mémoires techniques et le pilotage de leurs réponses aux marchés publics.
              </p>
              <p className="text-muted-foreground text-xs">
                <em>+10 ans d'expertise · +400M€ remportés pour nos clients · +48% de taux de réussite</em>
              </p>
            </div>

            <nav aria-label="Nos services d'appels d'offres">
              <h2 className="font-display font-semibold text-foreground mb-4 text-sm uppercase tracking-wider">
                Nos Expertises
              </h2>
              <ul className="space-y-2">
                {services.map((service) => (
                  <li key={service.label}>
                    <Link
                      to="/#expertises"
                      className="text-muted-foreground hover:text-primary transition-colors text-sm group"
                      title={service.description}
                    >
                      <span className="group-hover:underline">{service.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div>
              <h2 className="font-display font-semibold text-foreground mb-4 text-sm uppercase tracking-wider">
                Domaines d'expertise
              </h2>
              <ul className="flex flex-wrap gap-2">
                {expertise.map((keyword) => (
                  <li
                    key={keyword}
                    className="text-xs px-2 py-1 bg-white/5 border border-white/10 rounded text-muted-foreground"
                  >
                    {keyword}
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground text-xs mt-4 leading-relaxed">
                Intervention sur l'ensemble du territoire français : marchés d'État,
                collectivités territoriales, établissements publics et grands comptes privés.
              </p>
            </div>

            <address className="not-italic">
              <h2 className="font-display font-semibold text-foreground mb-4 text-sm uppercase tracking-wider">
                Contact
              </h2>
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <Mail size={18} className="text-primary" aria-hidden="true" />
                  <a href={`mailto:${contactInfo.email}`} className="text-muted-foreground hover:text-primary transition-colors text-sm" aria-label="Envoyer un email à HACKIFY">
                    {contactInfo.email}
                  </a>
                </li>
                <li className="flex items-center gap-3">
                  <Phone size={18} className="text-primary" aria-hidden="true" />
                  <a href={`tel:${contactInfo.phone.replace(/\s/g, '')}`} className="text-muted-foreground hover:text-primary transition-colors text-sm" aria-label="Appeler HACKIFY">
                    {contactInfo.phone}
                  </a>
                </li>
                <li className="flex items-center gap-3">
                  <MapPin size={18} className="text-primary" aria-hidden="true" />
                  <span className="text-muted-foreground text-sm">{contactInfo.address}</span>
                </li>
                <li className="flex items-center gap-3">
                  <Calendar size={18} className="text-primary" aria-hidden="true" />
                  <a href={contactInfo.calendly} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors text-sm" aria-label="Prendre rendez-vous avec HACKIFY sur Calendly">
                    Prendre rendez-vous
                  </a>
                </li>
              </ul>
            </address>
          </div>

          <div className="h-px bg-border/50 my-8" role="separator" />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <a href={contactInfo.linkedin} target="_blank" rel="noopener noreferrer" aria-label="Suivre HACKIFY sur LinkedIn" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                <Linkedin size={20} aria-hidden="true" />
                <span className="text-sm hidden sm:inline">LinkedIn</span>
              </a>
              <span className="text-muted-foreground text-xs">Cabinet français · Données hébergées en France</span>
            </div>

            <div className="flex items-center gap-4 text-muted-foreground text-sm">
              <Link to="/mentions-legales" className="hover:text-primary transition-colors">Mentions légales</Link>
              <span>·</span>
              <Link to="/politique-confidentialite" className="hover:text-primary transition-colors">Confidentialité</Link>
              <span>·</span>
              <span>© {new Date().getFullYear()} HACKIFY</span>
            </div>
          </div>
        </div>

        <div className="h-32 md:h-48 flex items-center justify-center overflow-hidden" aria-hidden="true">
          <TextHoverEffect text="HACKIFY" />
        </div>
      </div>
    </footer>
  );
}

export default HoverFooter;
