import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, Clock, XCircle, Unlock } from "lucide-react";
import { useServer } from "@/context/ServerContext";

export default function Candidature() {
  const server = useServer();
  const [form, setForm] = useState({ character_name: "", age: 18, discord_id: "", background: "", rp_experience: "", why_join: "" });
  const [submitting, setSubmitting] = useState(false);
  const [mine, setMine] = useState([]);

  const load = () => api.get("/applications/mine").then((r) => setMine(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/applications", { ...form, age: Number(form.age), discord_id: form.discord_id || null });
      toast.success("Candidature Envoyée. Le staff vous Répondra sous 72h.");
      setForm({ character_name: "", age: 18, discord_id: "", background: "", rp_experience: "", why_join: "" });
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally { setSubmitting(false); }
  };

  // Mode FA : accès libre, pas de candidature
  if (server.wl_mode === "fa") {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <div className="border border-[#10B981]/30 rounded bg-[#10B981]/5 p-10">
          <Unlock size={40} className="text-[#10B981] mx-auto mb-4" />
          <h1 className="font-display text-3xl font-bold">Accès Libre (FA)</h1>
          <p className="text-[#8B949E] mt-4 leading-relaxed">
            Le serveur est actuellement en mode <span className="text-[#10B981] font-semibold">Free Access</span> — tu peux rejoindre directement sans candidature.<br />
            Connecte-toi simplement en jeu via FiveM.
          </p>
          <Badge className="mt-6 bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30 text-sm px-4 py-1">Whitelist désactivée par le staff</Badge>
        </div>
      </div>
    );
  }

  const statusBadge = (s) => {
    if (s === "approved") return <Badge className="bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30"><CheckCircle2 size={12} className="mr-1" /> Approuvée</Badge>;
    if (s === "rejected") return <Badge className="bg-[#DC2626]/15 text-[#DC2626] border-[#DC2626]/30"><XCircle size={12} className="mr-1" /> Refusée</Badge>;
    return <Badge className="bg-[#E4B823]/15 text-[#E4B823] border-[#E4B823]/30"><Clock size={12} className="mr-1" /> En Attente</Badge>;
  };

  return (
    <div className="max-w-4xl mx-auto px-6 lg:px-10 py-20" data-testid="candidature-page">
      <div className="text-xs uppercase tracking-[0.25em] text-[#E4B823] font-medium">// Whitelist</div>
      <h1 className="font-display text-5xl lg:text-6xl font-bold tracking-tighter mt-3">Candidature</h1>
      <p className="text-[#8B949E] mt-6 leading-relaxed max-w-2xl">
        Postulez pour Rejoindre Bruxelles RP en Tant que Joueur Whitelist. Présentez votre Personnage et votre Expérience RP. Le Staff Répond Généralement sous 72 Heures.
      </p>

      {mine.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-semibold mb-4">Mes Candidatures</h2>
          <div className="space-y-3">
            {mine.map((a, i) => (
              <div key={a.id} className="border border-white/10 rounded p-5 bg-[#0C1014] flex items-start justify-between gap-4" data-testid={`my-app-${i}`}>
                <div>
                  <div className="font-display font-semibold">{a.character_name} <span className="text-[#8B949E] font-normal text-sm">· {a.age} ans</span></div>
                  <div className="text-xs text-[#8B949E] font-mono mt-1">{new Date(a.created_at).toLocaleString("fr-BE")}</div>
                  {a.admin_note && (
                    <div className="mt-3 text-sm text-white/70 italic border-l-2 border-[#E4B823]/40 pl-3">"{a.admin_note}"</div>
                  )}
                </div>
                {statusBadge(a.status)}
              </div>
            ))}
          </div>
        </section>
      )}

      <form onSubmit={submit} className="mt-12 space-y-6 border border-white/10 rounded p-8 bg-[#0C1014]">
        <h2 className="font-display text-2xl font-semibold">Nouvelle Candidature</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Nom du Personnage</Label>
            <Input required value={form.character_name} onChange={(e) => setForm({ ...form, character_name: e.target.value })}
              placeholder="Marc Vandamme" data-testid="app-character-input"
              className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823] focus-visible:ring-[#E4B823]/30" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Âge du Personnage</Label>
            <Input required type="number" min={15} max={99} value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })}
              data-testid="app-age-input"
              className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823] focus-visible:ring-[#E4B823]/30" />
          </div>
        </div>

        <div>
          <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Identifiant Discord <span className="text-[#8B949E] normal-case tracking-normal">(Pour Recevoir le Rôle Whitelist Automatiquement)</span></Label>
          <Input value={form.discord_id} onChange={(e) => setForm({ ...form, discord_id: e.target.value })}
            placeholder="123456789012345678" data-testid="app-discord-input"
            className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823] focus-visible:ring-[#E4B823]/30 font-mono" />
          <p className="text-xs text-[#8B949E] mt-2">Clic-Droit sur Ton Profil Discord → "Copier l'Identifiant" (Active le Mode Développeur dans Tes Paramètres).</p>
        </div>

        <div>
          <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Background du Personnage</Label>
          <Textarea required minLength={20} rows={5} value={form.background} onChange={(e) => setForm({ ...form, background: e.target.value })}
            placeholder="Racontez l'Histoire, l'Enfance, la Pprofession et la Motivation de votre Personnage..."
            data-testid="app-background-input"
            className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823] focus-visible:ring-[#E4B823]/30" />
        </div>

        <div>
          <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Expérience RP</Label>
          <Textarea required minLength={10} rows={3} value={form.rp_experience} onChange={(e) => setForm({ ...form, rp_experience: e.target.value })}
            placeholder="Décrivez votre Expérience sur d'Autres Serveurs RP..."
            data-testid="app-rp-input"
            className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823] focus-visible:ring-[#E4B823]/30" />
        </div>

        <div>
          <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Pourquoi Bruxelles RP ?</Label>
          <Textarea required minLength={10} rows={3} value={form.why_join} onChange={(e) => setForm({ ...form, why_join: e.target.value })}
            placeholder="Pourquoi Voulez-vous Rejoindre notre Communauté ?"
            data-testid="app-why-input"
            className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823] focus-visible:ring-[#E4B823]/30" />
        </div>

        <Button type="submit" disabled={submitting} data-testid="app-submit-btn" className="w-full bg-[#E4B823] text-black hover:bg-[#FCD34D] h-12 font-semibold">
          {submitting ? "Envoi en Cours..." : "Envoyer ma Candidature"}
        </Button>
      </form>
    </div>
  );
}
