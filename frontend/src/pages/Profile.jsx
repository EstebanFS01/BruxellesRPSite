import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { User as UserIcon, Save, Eye } from "lucide-react";

const STATUS_LABELS = {
  vivant: { label: "Vivant", color: "#10B981" },
  en_fuite: { label: "En Fuite", color: "#E4B823" },
  decede: { label: "Décédé", color: "#DC2626" },
  inconnu: { label: "Inconnu", color: "#8B949E" },
};

export default function Profile() {
  const { user } = useAuth();
  const [p, setP] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/profiles/me").then((r) => setP(r.data)).finally(() => setLoading(false));
  }, []);

  const update = (k, v) => setP((prev) => ({ ...prev, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...p };
      delete payload.user_id; delete payload.username; delete payload.updated_at;
      const { data } = await api.put("/profiles/me", payload);
      setP(data);
      toast.success("Profil mis à jour");
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setSaving(false); }
  };

  if (loading || !p) return <div className="min-h-[60vh] flex items-center justify-center text-[#8B949E] font-mono text-sm">Chargement...</div>;

  return (
    <div className="max-w-5xl mx-auto px-6 lg:px-10 py-16" data-testid="profile-page">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-[#E4B823] font-medium">// Mon Personnage</div>
          <h1 className="font-display text-4xl lg:text-5xl font-bold tracking-tighter mt-3">Profil RP</h1>
          <p className="text-[#8B949E] mt-3 text-sm">Décrivez votre Personnage et votre Histoire à Bruxelles.</p>
        </div>
        <Link to={`/joueurs/${user.username}`}>
          <Button variant="outline" className="bg-white/5 border-white/15 hover:bg-white/10" data-testid="profile-view-public-btn">
            <Eye size={16} className="mr-2" /> Voir le Profil Public
          </Button>
        </Link>
      </div>

      <form onSubmit={save} className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Avatar + status */}
        <div className="border border-white/10 rounded p-6 bg-[#0C1014] space-y-5 lg:row-span-2">
          <div className="relative aspect-square rounded overflow-hidden border border-white/10 bg-[#050608] flex items-center justify-center">
            {p.photo_url ? (
              <img src={p.photo_url} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <UserIcon size={64} className="text-[#2D333B]" />
            )}
          </div>
          <div>
            <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">URL Photo</Label>
            <Input value={p.photo_url || ""} onChange={(e) => update("photo_url", e.target.value)}
              placeholder="https://..." data-testid="profile-photo-input"
              className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823]" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Statut</Label>
            <Select value={p.status || "vivant"} onValueChange={(v) => update("status", v)}>
              <SelectTrigger data-testid="profile-status-select" className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0C1014] border-white/10">
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="mt-3">
              <Badge style={{ background: `${STATUS_LABELS[p.status]?.color}15`, color: STATUS_LABELS[p.status]?.color, borderColor: `${STATUS_LABELS[p.status]?.color}40` }} className="border">
                {STATUS_LABELS[p.status]?.label}
              </Badge>
            </div>
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-white/5">
            <div>
              <div className="text-sm font-medium">Profil Public</div>
              <div className="text-xs text-[#8B949E] mt-1">Visible dans l'Annuaire des Joueurs</div>
            </div>
            <Switch checked={p.is_public} onCheckedChange={(v) => update("is_public", v)} data-testid="profile-public-switch" />
          </div>
        </div>

        {/* Identity */}
        <div className="lg:col-span-2 border border-white/10 rounded p-6 bg-[#0C1014] space-y-5">
          <h2 className="font-display text-lg font-semibold">Identité</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Nom du Personnage</Label>
              <Input value={p.character_name || ""} onChange={(e) => update("character_name", e.target.value)}
                placeholder="Marc Vandamme" data-testid="profile-name-input"
                className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823]" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Date de Naissance</Label>
              <Input value={p.date_of_birth_ic || ""} onChange={(e) => update("date_of_birth_ic", e.target.value)}
                placeholder="12/06/1992" data-testid="profile-dob-input"
                className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823]" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Profession</Label>
              <Input value={p.profession || ""} onChange={(e) => update("profession", e.target.value)}
                placeholder="Pompier" data-testid="profile-profession-input"
                className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823]" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Entreprise</Label>
              <Input value={p.faction || ""} onChange={(e) => update("faction", e.target.value)}
                placeholder="Sapeurs Pompiers" data-testid="profile-faction-input"
                className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823]" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Adresse / Quartier</Label>
              <Input value={p.address || ""} onChange={(e) => update("address", e.target.value)}
                placeholder="Rue Neuve, Bruxelles-Centre" data-testid="profile-address-input"
                className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823]" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Téléphone</Label>
              <Input value={p.phone_ic || ""} onChange={(e) => update("phone_ic", e.target.value)}
                placeholder="04XX XX XX XX" data-testid="profile-phone-input"
                className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823]" />
            </div>
          </div>
        </div>

        {/* Biography */}
        <div className="lg:col-span-2 border border-white/10 rounded p-6 bg-[#0C1014] space-y-5">
          <h2 className="font-display text-lg font-semibold">Histoire & Compétences</h2>
          <div>
            <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Biographie</Label>
            <Textarea rows={6} value={p.biography || ""} onChange={(e) => update("biography", e.target.value)}
              placeholder="L'histoire de votre Personnage, son Enfance, ses Motivations..."
              data-testid="profile-bio-input"
              className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823]" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Compétences / Talents</Label>
            <Textarea rows={3} value={p.skills || ""} onChange={(e) => update("skills", e.target.value)}
              placeholder="Conduite, Mécanique, Tir, Négociation..."
              data-testid="profile-skills-input"
              className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823]" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Casier Judiciaire</Label>
            <Textarea rows={3} value={p.criminal_record || ""} onChange={(e) => update("criminal_record", e.target.value)}
              placeholder="Aucun Antécédent / Vol Qualifié 2026 / Évasion..."
              data-testid="profile-record-input"
              className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823]" />
          </div>
        </div>

        <div className="lg:col-span-3 flex justify-end">
          <Button type="submit" disabled={saving} data-testid="profile-save-btn" className="bg-[#E4B823] text-black hover:bg-[#FCD34D] h-12 px-8 font-semibold">
            <Save size={16} className="mr-2" />
            {saving ? "Enregistrement..." : "Enregistrer le Profil"}
          </Button>
        </div>
      </form>
    </div>
  );
}
