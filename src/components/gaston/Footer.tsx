import Logo from "./Logo";
import { FOOTER } from "@/lib/gastonContent";

/** Footer blanc : logo, contact mail, site éditeur, copyright. */
const Footer = () => (
  <footer className="border-t border-[#0f1d34]/5 bg-white">
    <div className="mx-auto flex max-w-[1152px] flex-col items-center gap-4 px-5 py-10 text-center md:flex-row md:justify-between md:text-left">
      <Logo height={32} />
      <div className="flex flex-col items-center gap-1 text-[15px] text-[#0f1d34]/70 md:items-end">
        <a
          href={`mailto:${FOOTER.email}`}
          className="font-medium transition-colors hover:text-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
        >
          {FOOTER.email}
        </a>
        <a
          href={FOOTER.site}
          target="_blank"
          rel="noreferrer"
          className="font-medium transition-colors hover:text-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
        >
          {FOOTER.siteLabel}
        </a>
        <span>{FOOTER.copyright}</span>
      </div>
    </div>
  </footer>
);

export default Footer;
