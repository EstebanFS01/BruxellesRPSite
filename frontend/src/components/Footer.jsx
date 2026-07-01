import { Link } from "react-router-dom";
import { DiscordLogo, GameController } from "@phosphor-icons/react";
import Logo from "@/components/Logo";

export default function Footer({ info }) {
  return (
    <footer className="border-t border-white/10 bg-[#050608] mt-24" data-testid="main-footer">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16 grid grid-cols-1 md:grid-cols-4 gap-12">
        <div className="md:col-span-2">
          <div className="flex items-center gap-3">
            <Logo size={48} />
            <div>
              <div className="font-display font-bold">Bruxelles RôlePlay</div>
              <div className="text-xs text-[#8B949E] font-mono uppercase tracking-wider">Belgique · FiveM</div>
            </div>
          </div>
          <p className="mt-6 text-sm text-[#8B949E] max-w-md leading-relaxed">
            Le Serveur RP Francophone Immersif Inspiré des Rues de Bruxelles. Communauté Belge, Entreprises Équilibrées, Immersion Totale.
          </p>
          <div className="belgian-bar mt-6 w-32" aria-hidden="true" />
        </div>

        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#8B949E] mb-4 font-medium">Navigation</div>
          <ul className="space-y-2 text-sm">
            <li><Link to="/factions" className="text-white/80 hover:text-[#E4B823]">Entreprises</Link></li>
            <li><Link to="/actualites" className="text-white/80 hover:text-[#E4B823]">Actualités</Link></li>
            <li><Link to="/reglement" className="text-white/80 hover:text-[#E4B823]">Règlement</Link></li>
            <li><Link to="/boutique" className="text-white/80 hover:text-[#E4B823]">Boutique VIP</Link></li>
          </ul>
        </div>

        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#8B949E] mb-4 font-medium">Rejoignez-Nous</div>
          <a
            href={info?.discord || "https://discord.gg/3USafSJEYF"}
            target="_blank"
            rel="noreferrer"
            data-testid="footer-discord-link"
            className="flex items-center gap-2 text-sm text-white hover:text-[#E4B823] transition-colors"
          >
            <DiscordLogo size={18} weight="fill" /> Discord Communautaire
          </a>
          <div className="mt-3 flex items-center gap-2 text-sm text-[#8B949E]">
            <GameController size={18} weight="duotone" />
            <code className="font-mono text-xs text-[#E4B823]">{info?.connect || "connect cfx.re/join/mxlqy9"}</code>
          </div>
        </div>
      </div>

      <div className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#8B949E] font-mono">
          <div>© 2026 Bruxelles RôlePlay ·</div>
          <div className="uppercase tracking-[0.2em]">Made in Belgium 🇧🇪</div>
        </div>
      </div>
    </footer>
  );
}
