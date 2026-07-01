import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { User as UserIcon, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const STATUS = {
  vivant: { label: "Vivant", color: "#10B981" },
  en_fuite: { label: "En Fuite", color: "#E4B823" },
  decede: { label: "Décédé", color: "#DC2626" },
  inconnu: { label: "Inconnu", color: "#8B949E" },
};

export default function Joueurs() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    api.get("/profiles").then((r) => setProfiles(r.data)).finally(() => setLoading(false));
  }, []);

  const filtered = profiles.filter((p) => {
    const t = q.toLowerCase();
    return (
      p.username?.toLowerCase().includes(t) ||
      p.character_name?.toLowerCase().includes(t) ||
      p.profession?.toLowerCase().includes(t) ||
      p.faction?.toLowerCase().includes(t)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16" data-testid="joueurs-page">
      <div className="max-w-2xl">
        <div className="text-xs uppercase tracking-[0.25em] text-[#E4B823] font-medium">// Annuaire</div>
        <h1 className="font-display text-5xl lg:text-6xl font-bold tracking-tighter mt-3">Joueurs</h1>
        <p className="text-[#8B949E] mt-6 leading-relaxed">
          Découvrez les Personnages de la Communauté Bruxelles RôlePlay. Cherchez par Pseudo, Nom de Personnage, Profession ou Entreprise.
        </p>
      </div>

      <div className="mt-10 relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B949E]" />
        <Input
          placeholder="Rechercher un Joueur..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          data-testid="joueurs-search-input"
          className="pl-10 bg-[#0C1014] border-white/10 focus:border-[#E4B823]"
        />
      </div>

      {loading ? (
        <div className="mt-16 text-[#8B949E] font-mono text-sm">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="mt-16 border border-dashed border-white/10 rounded p-12 text-center" data-testid="joueurs-empty">
          <UserIcon size={32} className="text-[#2D333B] mx-auto" />
          <p className="text-[#8B949E] mt-3">Aucun Joueur Trouvé.</p>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p, i) => {
            const st = STATUS[p.status] || STATUS.inconnu;
            return (
              <Link
                key={p.user_id}
                to={`/joueurs/${p.username}`}
                data-testid={`joueur-card-${i}`}
                className="card-hover border border-white/10 rounded overflow-hidden bg-[#0C1014] block"
              >
                <div className="aspect-square overflow-hidden bg-[#050608] flex items-center justify-center">
                  {p.photo_url ? (
                    <img src={p.photo_url} alt={p.character_name || p.username} className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon size={48} className="text-[#2D333B]" />
                  )}
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="font-display font-semibold truncate">{p.character_name || p.username}</div>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: st.color }} title={st.label} />
                  </div>
                  <div className="text-xs text-[#8B949E] font-mono mt-1 truncate">@{p.username}</div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {p.profession && <Badge variant="outline" className="border-white/10 text-[10px] text-[#8B949E]">{p.profession}</Badge>}
                    {p.faction && <Badge variant="outline" className="border-[#E4B823]/30 text-[10px] text-[#E4B823]">{p.faction}</Badge>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
