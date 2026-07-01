import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { User as UserIcon, MapPin, Phone, Briefcase, Calendar, Shield, ArrowLeft, Pencil } from "lucide-react";

const STATUS = {
  vivant: { label: "Vivant", color: "#10B981" },
  en_fuite: { label: "En Fuite", color: "#E4B823" },
  decede: { label: "Décédé", color: "#DC2626" },
  inconnu: { label: "Inconnu", color: "#8B949E" },
};

export default function JoueurDetail() {
  const { username } = useParams();
  const { user } = useAuth();
  const [p, setP] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/profiles/${username}`)
      .then((r) => setP(r.data))
      .catch((e) => setError(formatApiError(e)))
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center text-[#8B949E] font-mono text-sm">Chargement...</div>;
  if (error || !p) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center" data-testid="joueur-not-found">
        <UserIcon size={48} className="text-[#2D333B] mx-auto" />
        <h1 className="font-display text-3xl font-bold mt-4">Profil Introuvable</h1>
        <p className="text-[#8B949E] mt-3">{error}</p>
        <Link to="/joueurs"><Button className="mt-6 bg-[#E4B823] text-black hover:bg-[#FCD34D]">Retour à l'Annuaire</Button></Link>
      </div>
    );
  }

  const st = STATUS[p.status] || STATUS.inconnu;
  const isOwner = user && user.username === p.username;

  return (
    <div className="max-w-5xl mx-auto px-6 lg:px-10 py-12" data-testid="joueur-detail-page">
      <Link to="/joueurs" className="inline-flex items-center gap-2 text-sm text-[#8B949E] hover:text-[#E4B823]" data-testid="back-to-joueurs">
        <ArrowLeft size={14} /> Annuaire
      </Link>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sidebar */}
        <div className="md:col-span-1 space-y-4">
          <div className="border border-white/10 rounded overflow-hidden bg-[#0C1014]">
            <div className="aspect-square bg-[#050608] flex items-center justify-center">
              {p.photo_url ? (
                <img src={p.photo_url} alt={p.character_name || p.username} className="w-full h-full object-cover" />
              ) : (
                <UserIcon size={80} className="text-[#2D333B]" />
              )}
            </div>
            <div className="p-5 border-t border-white/5">
              <Badge style={{ background: `${st.color}15`, color: st.color, borderColor: `${st.color}40` }} className="border w-full justify-center py-1.5">
                <span className="w-1.5 h-1.5 rounded-full mr-2" style={{ background: st.color }} />
                {st.label}
              </Badge>
            </div>
          </div>

          {isOwner && (
            <Link to="/profile" className="block">
              <Button variant="outline" className="w-full bg-white/5 border-white/15 hover:bg-white/10" data-testid="edit-profile-btn">
                <Pencil size={14} className="mr-2" /> Modifier mon Profil
              </Button>
            </Link>
          )}

          <div className="border border-white/10 rounded p-5 bg-[#0C1014] space-y-4 text-sm">
            {p.profession && (
              <div className="flex items-start gap-3">
                <Briefcase size={16} className="text-[#E4B823] mt-0.5 shrink-0" />
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Profession</div>
                  <div>{p.profession}</div>
                </div>
              </div>
            )}
            {p.faction && (
              <div className="flex items-start gap-3">
                <Shield size={16} className="text-[#E4B823] mt-0.5 shrink-0" />
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Entreprise</div>
                  <div>{p.faction}</div>
                </div>
              </div>
            )}
            {p.address && (
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-[#E4B823] mt-0.5 shrink-0" />
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Adresse</div>
                  <div>{p.address}</div>
                </div>
              </div>
            )}
            {p.phone_ic && (
              <div className="flex items-start gap-3">
                <Phone size={16} className="text-[#E4B823] mt-0.5 shrink-0" />
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Téléphone</div>
                  <div className="font-mono">{p.phone_ic}</div>
                </div>
              </div>
            )}
            {p.date_of_birth_ic && (
              <div className="flex items-start gap-3">
                <Calendar size={16} className="text-[#E4B823] mt-0.5 shrink-0" />
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Né le</div>
                  <div className="font-mono">{p.date_of_birth_ic}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main */}
        <div className="md:col-span-2 space-y-6">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-[#E4B823] font-medium">// Personnage</div>
            <h1 className="font-display text-5xl font-bold tracking-tighter mt-3">{p.character_name || p.username}</h1>
            <div className="mt-2 text-[#8B949E] font-mono text-sm">@{p.username}</div>
          </div>

          {p.biography && (
            <section className="border border-white/10 rounded p-6 bg-[#0C1014]">
              <h2 className="font-display text-lg font-semibold mb-3">Biographie</h2>
              <p className="text-white/80 leading-relaxed whitespace-pre-wrap">{p.biography}</p>
            </section>
          )}

          {p.skills && (
            <section className="border border-white/10 rounded p-6 bg-[#0C1014]">
              <h2 className="font-display text-lg font-semibold mb-3">Compétences</h2>
              <p className="text-white/80 leading-relaxed whitespace-pre-wrap">{p.skills}</p>
            </section>
          )}

          {p.criminal_record && (
            <section className="border border-[#DC2626]/20 rounded p-6 bg-[#0C1014]">
              <h2 className="font-display text-lg font-semibold mb-3 flex items-center gap-2">
                <Shield size={18} className="text-[#DC2626]" /> Casier Judiciaire
              </h2>
              <p className="text-white/80 leading-relaxed whitespace-pre-wrap font-mono text-sm">{p.criminal_record}</p>
            </section>
          )}

          {!p.biography && !p.skills && !p.criminal_record && (
            <div className="border border-dashed border-white/10 rounded p-12 text-center">
              <p className="text-[#8B949E]">Ce Joueur n'a pas Encore Détaillé son Personnage.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
