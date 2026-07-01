import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Send, Lock, Unlock, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { FactionIcon } from "@/lib/factionIcons";

export default function Factions() {
  const { user } = useAuth();
  const [factions, setFactions] = useState([]);
  const [filter, setFilter] = useState("Tous");
  const [openApply, setOpenApply] = useState(null);
  const [mine, setMine] = useState([]);
  const categories = ["Tous", "Force de l'ordre", "Secours", "Civils", "Métiers"];

  useEffect(() => {
    api.get("/factions").then((r) => setFactions(r.data)).catch(() => {});
    if (user && user !== false) {
      api.get("/business-applications/mine").then((r) => setMine(r.data)).catch(() => {});
    }
  }, [user]);

  const filtered = filter === "Tous" ? factions : factions.filter((f) => f.category === filter);
  const pendingFor = (key) => mine.some((m) => m.faction_key === key && m.status === "pending");

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20" data-testid="factions-page">
      <div className="max-w-2xl">
        <div className="text-xs uppercase tracking-[0.25em] text-[#E4B823] font-medium">// Organisations</div>
        <h1 className="font-display text-5xl lg:text-6xl font-bold tracking-tighter mt-3">Entreprises</h1>
        <p className="text-[#8B949E] mt-6 leading-relaxed">
          Choisissez votre Rôle dans Bruxelles. Postulez à une Organisation pour Rejoindre son Effectif.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mt-12">
        {categories.map((c, i) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            data-testid={`faction-filter-${i}`}
            className={`px-4 py-2 text-xs uppercase tracking-[0.2em] border rounded-full font-mono transition-colors ${
              filter === c ? "border-[#E4B823] text-[#E4B823] bg-[#E4B823]/10" : "border-white/10 hover:border-[#E4B823]/40 hover:text-[#E4B823]"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
        {filtered.map((f, i) => {
          const pending = pendingFor(f.key);
          const open = f.recruitment_open !== false;
          const isOwner = user && user.id === f.owner_user_id;
          return (
            <Link
              key={f.key}
              to={`/entreprise/${f.key}`}
              data-testid={`faction-detail-${i}`}
              className="card-hover p-7 border border-white/10 rounded bg-[#0C1014] flex flex-col group"
            >
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded flex items-center justify-center" style={{ background: `${f.color}15`, color: f.color }}>
                  <FactionIcon icon_key={f.icon_key} size={22} />
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">{f.category}</span>
                  {f.is_whitelist && (
                    open ? (
                      <Badge className="bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30 text-[9px] uppercase tracking-wider"><Unlock size={9} className="mr-1" />Recrute</Badge>
                    ) : (
                      <Badge className="bg-[#DC2626]/15 text-[#DC2626] border-[#DC2626]/30 text-[9px] uppercase tracking-wider"><Lock size={9} className="mr-1" />Fermé</Badge>
                    )
                  )}
                </div>
              </div>
              <h3 className="font-display font-semibold text-lg mt-5 group-hover:text-[#E4B823] transition-colors">{f.name}</h3>
              <p className="text-sm text-[#8B949E] mt-2 leading-relaxed flex-1 line-clamp-3">{f.description}</p>
              {f.owner_username && (
                <div className="mt-3 text-xs text-[#E4B823] flex items-center gap-1.5 font-mono">
                  <Crown size={12} /> Patron : {f.owner_username}
                </div>
              )}
              <div className="mt-5 pt-5 border-t border-white/5 flex items-center justify-between text-xs font-mono">
                <span className="text-[#8B949E] uppercase tracking-wider">Places</span>
                <span className="text-[#E4B823]">{f.slots_max ? `0/${f.slots_max}` : "Freelance"}</span>
              </div>
              {f.is_whitelist && (
                user && user !== false ? (
                  <Button
                    onClick={(e) => { e.preventDefault(); setOpenApply(f); }}
                    disabled={pending || !open}
                    data-testid={`faction-apply-${f.key}`}
                    className="mt-4 w-full bg-[#E4B823] text-black hover:bg-[#FCD34D] disabled:opacity-50"
                  >
                    {pending ? "Candidature en Attente" : !open ? "Recrutement Fermé" : <><Send size={14} className="mr-2" /> Postuler</>}
                  </Button>
                ) : (
                  <Button variant="outline" className="mt-4 w-full bg-white/5 border-white/15 hover:bg-white/10" data-testid={`faction-login-${f.key}`}
                    onClick={(e) => { e.preventDefault(); window.location.href = "/login"; }}>
                    Connexion Requise
                  </Button>
                )
              )}
              {isOwner && (
                <Badge className="mt-3 bg-[#E4B823] text-black w-fit text-[10px] uppercase tracking-wider"><Crown size={10} className="mr-1" />Vous êtes Patron</Badge>
              )}
            </Link>
          );
        })}
      </div>

      <ApplyDialog open={openApply} onClose={() => setOpenApply(null)} onSubmitted={() => {
        api.get("/business-applications/mine").then((r) => setMine(r.data));
      }} />
    </div>
  );
}

function ApplyDialog({ open, onClose, onSubmitted }) {
  const [position, setPosition] = useState("");
  const [discordId, setDiscordId] = useState("");
  const [motivation, setMotivation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open?.positions?.length) setPosition(open.positions[0]);
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/business-applications", {
        faction_key: open.key,
        faction_name: open.name,
        position,
        discord_id: discordId || null,
        motivation,
      });
      toast.success("Candidature envoyée à " + open.name);
      onSubmitted?.(); onClose();
      setMotivation(""); setDiscordId("");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={!!open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#0C1014] border-white/10 max-w-lg">
        {open && (
          <>
            <DialogHeader>
              <Badge variant="outline" className="border-[#E4B823]/30 text-[#E4B823] text-[10px] uppercase tracking-wider w-fit mb-2">{open.category}</Badge>
              <DialogTitle className="font-display text-2xl">{open.name}</DialogTitle>
              <DialogDescription>Postulez pour Rejoindre Cette Entreprise. Le Patron ou un Admin Examinera votre Candidature.</DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Poste Souhaité</Label>
                <select value={position} onChange={(e) => setPosition(e.target.value)} required
                  data-testid="business-position-select"
                  className="mt-2 w-full bg-transparent border border-white/10 rounded h-10 px-3 text-sm focus:border-[#E4B823] focus:outline-none">
                  {(open.positions || []).map((p) => <option key={p} value={p} className="bg-[#0C1014]">{p}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Discord ID</Label>
                <Input value={discordId} onChange={(e) => setDiscordId(e.target.value)} placeholder="123456789012345678"
                  data-testid="business-discord-input" className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823] font-mono" />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Motivation</Label>
                <Textarea required minLength={10} rows={5} value={motivation} onChange={(e) => setMotivation(e.target.value)}
                  placeholder="Pourquoi Voulez-vous Rejoindre cette Entreprise ? Quelle est votre Expérience ?"
                  data-testid="business-motivation-input"
                  className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823]" />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting} data-testid="business-submit-btn" className="bg-[#E4B823] text-black hover:bg-[#FCD34D] font-semibold">
                  {submitting ? "Envoi..." : "Envoyer la Candidature"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
