import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Marquee from "react-fast-marquee";
import { motion } from "framer-motion";
import { Shield, Wrench, Users, Heart, Briefcase, ArrowRight, Copy, Check } from "lucide-react";
import { DiscordLogo, GameController, MapPin } from "@phosphor-icons/react";
import { toast } from "sonner";
import Logo from "@/components/Logo";

const HERO_IMG = "https://images.unsplash.com/photo-1660944192434-1440a5ddde6e?auto=format&fit=crop&q=80";

const FACTION_PREVIEW = [
  { icon: Shield, name: "Police de Bruxelles", desc: "Police Judiciaire", color: "#3B82F6" },
  { icon: Heart, name: "CHU de Bruxelles", desc: "Urgences Médicales", color: "#DC2626" },
  { icon: Wrench, name: "GearHead Customs", desc: "Réparation & Tuning", color: "#F59E0B" },
  { icon: Briefcase, name: "Gouvernement", desc: "Administration", color: "#10B981" },
];

export default function Home() {
  const [info, setInfo] = useState(null);
  const [news, setNews] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get("/server/info").then((r) => setInfo(r.data)).catch(() => {});
    api.get("/news").then((r) => setNews(r.data.slice(0, 3))).catch(() => {});
  }, []);

  const copyConnect = () => {
    navigator.clipboard.writeText(info?.connect || "connect cfx.re/join/mxlqy9");
    setCopied(true);
    toast.success("Adresse de Connexion copiée");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div data-testid="home-page">
      {/* HERO */}
      <section className="relative min-h-[92vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={HERO_IMG} alt="Bruxelles la Nuit" className="w-full h-full object-cover" />
          <div className="absolute inset-0 hero-overlay" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 lg:px-10 py-24 w-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-3xl"
          >
            <div className="flex items-center gap-4 mb-6">
              <Logo size={72} showRing />
              <div>
                <Badge className="bg-[#E4B823]/15 border border-[#E4B823]/40 text-[#E4B823] hover:bg-[#E4B823]/20 font-mono uppercase tracking-[0.2em] text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E4B823] mr-2 animate-pulse" />
                  Serveur en Ligne
                </Badge>
                <div className="text-xs text-[#8B949E] font-mono uppercase tracking-[0.2em] mt-2">Belgique · BE · FiveM</div>
              </div>
            </div>

            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter leading-[1.05]">
              Bienvenue sur<br />
              <span className="text-[#E4B823]">Bruxelles</span> RôlePlay.
            </h1>

            <p className="mt-8 text-lg text-white/80 max-w-2xl leading-relaxed">
              Le Serveur FiveM Belge le plus Immersif. Vivez une Seconde vie dans les Rues de Bruxelles Réimaginée — Entreprises Sérieuses, Économie Équilibrée, Communauté Francophone.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Button
                onClick={copyConnect}
                size="lg"
                data-testid="hero-connect-btn"
                className="bg-[#E4B823] text-black hover:bg-[#FCD34D] font-semibold h-14 px-8 text-base group"
              >
                {copied ? <Check className="mr-2" size={18} /> : <Copy className="mr-2" size={18} />}
                {info?.connect || "connect cfx.re/join/mxlqy9"}
              </Button>
              <a
                href={info?.discord || "https://discord.gg/bxrp"}
                target="_blank"
                rel="noreferrer"
                data-testid="hero-discord-btn"
              >
                <Button size="lg" variant="outline" className="bg-white/5 border-white/15 text-white hover:bg-white/10 h-14 px-8 text-base">
                  <DiscordLogo size={20} weight="fill" className="mr-2" /> Rejoindre Discord
                </Button>
              </a>
            </div>

            <div className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-2xl">
              {[
                { label: "Whitelist", value: info?.whitelisted ?? "—" },
                { label: "Slots Max", value: info?.max_slots ?? 128 },
                { label: "Uptime", value: info?.uptime ?? "99.8%" },
              ].map((s, i) => (
                <div key={i} className="border-l border-[#E4B823]/30 pl-4" data-testid={`hero-stat-${i}`}>
                  <div className="font-mono text-2xl font-bold text-white">{s.value}</div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E] mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* MARQUEE */}
      <section className="border-y border-white/10 bg-[#0C1014] py-6 marquee-wrap">
        <Marquee speed={40} gradient={false}>
          {["Roleplay Sérieux", "Économie Équilibrée", "Discord Actif 24/7", "Map Custom Bruxelles", "Entreprises Whitelist", "Anti-Cheat Premium", "Staff Francophone"].map((t, i) => (
            <div key={i} className="flex items-center gap-12 mx-12 font-mono text-sm uppercase tracking-[0.3em] text-white/40">
              <span>{t}</span>
              <span className="text-[#E4B823]">✦</span>
            </div>
          ))}
        </Marquee>
      </section>

      {/* FACTIONS PREVIEW */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-24">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-[#E4B823] font-medium mb-3">// 01 — Organisations</div>
            <h2 className="font-display text-4xl lg:text-5xl font-bold tracking-tighter">Entreprises Principales</h2>
          </div>
          <Link to="/factions" data-testid="factions-link" className="text-sm text-[#8B949E] hover:text-[#E4B823] flex items-center gap-2 group">
            Voir Toutes les Entreprises <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {FACTION_PREVIEW.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              viewport={{ once: true }}
              className="card-hover p-6 border border-white/10 rounded bg-[#0C1014]"
              data-testid={`faction-card-${i}`}
            >
              <div className="w-12 h-12 rounded flex items-center justify-center mb-5" style={{ background: `${f.color}15`, color: f.color }}>
                <f.icon size={22} />
              </div>
              <h3 className="font-display font-semibold text-lg">{f.name}</h3>
              <p className="text-sm text-[#8B949E] mt-1">{f.desc}</p>
              <div className="mt-5 pt-5 border-t border-white/5 text-xs font-mono text-[#8B949E] uppercase tracking-wider">
                Whitelist Requise
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ABOUT / FEATURES */}
      <section className="bg-[#0C1014] border-y border-white/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-24 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-[#E4B823] font-medium mb-3">// 02 — À Propos</div>
            <h2 className="font-display text-4xl lg:text-5xl font-bold tracking-tighter">Une Seconde vie<br />à la <span className="text-[#E4B823]">Belge</span>.</h2>
            <p className="mt-8 text-[#8B949E] leading-relaxed text-base">
              Bruxelles RP Réinvente l'Expérience de GTA V avec une Carte Custom Inspirée de Bruxelles — Grand-Place, Atomium, Quartiers Européens. Notre Équipe Développe des Scripts Maison pour Offrir un RôlePlay d'Élite : Système Judiciaire Complet, Économie Réaliste, Métiers Immersifs.
            </p>
            <ul className="mt-8 space-y-3 text-sm">
              {[
                "Map Custom : Bruxelles + Alentours",
                "Plus de 15 Métiers RP Whitelistés",
                "Système Bancaire & Immobilier Complet",
                "Staff Francophone Disponible 24/7",
                "Anti-Cheat Propriétaire",
              ].map((t, i) => (
                <li key={i} className="flex items-start gap-3 text-white/80">
                  <span className="text-[#E4B823] mt-1">▸</span> {t}
                </li>
              ))}
            </ul>
            <div className="mt-10 flex gap-3">
              <Link to="/reglement"><Button variant="outline" className="border-white/15 bg-white/5 hover:bg-white/10" data-testid="reglement-btn">Lire le Règlement</Button></Link>
              <Link to="/candidature"><Button className="bg-[#E4B823] text-black hover:bg-[#FCD34D]" data-testid="apply-btn">Postuler Whitelist</Button></Link>
            </div>
          </div>

          <div className="relative">
            <div className="aspect-[4/5] rounded overflow-hidden border border-white/10">
              <img src="https://6a44348c94555f542c2f2bb3.imgix.net/sandbox/photo-1666032956671-5cc9a6bcf7a4.avif" alt="Bruxelles RôlePlay" className="w-full h-full object-cover" />
            </div>
            <div className="absolute -bottom-6 -left-6 bg-[#050608] border border-[#E4B823]/30 rounded p-6 max-w-[280px] gold-glow">
              <MapPin size={20} weight="duotone" className="text-[#E4B823]" />
              <div className="mt-3 font-display font-semibold">Bruxelles, Belgique</div>
              <div className="text-xs text-[#8B949E] mt-1 font-mono">50.8503° N, 4.3517° E</div>
            </div>
          </div>
        </div>
      </section>

      {/* NEWS PREVIEW */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-24">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-[#E4B823] font-medium mb-3">// 03 — Actualités</div>
            <h2 className="font-display text-4xl lg:text-5xl font-bold tracking-tighter">Dernières News</h2>
          </div>
          <Link to="/actualites" data-testid="news-link" className="text-sm text-[#8B949E] hover:text-[#E4B823] flex items-center gap-2 group">
            Toutes les Actualités <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {news.map((n, i) => (
            <article key={n.id} className="card-hover border border-white/10 rounded overflow-hidden bg-[#0C1014]" data-testid={`home-news-${i}`}>
              {n.image_url && (
                <div className="aspect-[16/10] overflow-hidden">
                  <img src={n.image_url} alt={n.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-6">
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-[#E4B823]/30 text-[#E4B823]">{n.category}</Badge>
                <h3 className="font-display font-semibold text-lg mt-3 leading-snug">{n.title}</h3>
                <p className="text-sm text-[#8B949E] mt-2 line-clamp-2">{n.excerpt}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/10 bg-[#0C1014]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 text-center">
          <Logo size={96} className="mx-auto" showRing />
          <h2 className="font-display text-4xl lg:text-5xl font-bold tracking-tighter mt-6">Prêt à Rejoindre la Communauté ?</h2>
          <p className="text-[#8B949E] mt-4 max-w-xl mx-auto">Crée ton Compte Joueur, Postule pour la Whitelist et Démarre ton Aventure.</p>
          <div className="mt-8 flex flex-wrap gap-4 justify-center">
            <Link to="/register"><Button size="lg" className="bg-[#E4B823] text-black hover:bg-[#FCD34D] h-12 px-8" data-testid="cta-register-btn">Créer un Compte</Button></Link>
            <Link to="/factions"><Button size="lg" variant="outline" className="border-white/15 bg-white/5 hover:bg-white/10 h-12 px-8" data-testid="cta-factions-btn"><GameController size={18} className="mr-2" weight="fill" /> Explorer les Entreprises</Button></Link>
          </div>
        </div>
      </section>
    </div>
  );
}
