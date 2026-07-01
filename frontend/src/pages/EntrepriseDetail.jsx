import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { usePerms } from "@/hooks/usePerms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Crown, Lock, Unlock, Pencil, Save, Plus, X, Send, Users, FileText, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { FactionIcon, ICON_KEYS } from "@/lib/factionIcons";

function StatusBadge({ s }) {
  if (s === "approved") return <Badge className="bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30"><CheckCircle2 size={12} className="mr-1" /> Approuvée</Badge>;
  if (s === "rejected") return <Badge className="bg-[#DC2626]/15 text-[#DC2626] border-[#DC2626]/30"><XCircle size={12} className="mr-1" /> Refusée</Badge>;
  return <Badge className="bg-[#E4B823]/15 text-[#E4B823] border-[#E4B823]/30"><Clock size={12} className="mr-1" /> En Attente</Badge>;
}

export default function EntrepriseDetail() {
  const { key } = useParams();
  const { user } = useAuth();
  const perms = usePerms();
  const [f, setF] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [newPosition, setNewPosition] = useState("");
  const [apps, setApps] = useState([]);
  const [reviewApp, setReviewApp] = useState(null);
  const [reviewNote, setReviewNote] = useState("");

  const isOwner = user && user.id === f?.owner_user_id;
  const canManage = isOwner || perms.can?.("manage_business");

  const load = () => {
    api.get(`/factions/${key}`)
      .then((r) => { setF(r.data); setForm(r.data); })
      .catch((e) => setError(formatApiError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [key]);

  useEffect(() => {
    if (canManage) {
      api.get("/business-applications").then((r) => {
        setApps(r.data.filter((a) => a.faction_key === key));
      }).catch(() => {});
    }
  }, [canManage, key]);

  const saveEdits = async () => {
    try {
      const payload = {
        name: form.name, category: form.category, description: form.description,
        color: form.color, icon_key: form.icon_key, image_url: form.image_url || null,
        positions: form.positions || [], slots_max: form.slots_max ? Number(form.slots_max) : null,
      };
      const { data } = await api.patch(`/factions/${key}`, payload);
      setF(data); setForm(data); setEditing(false);
      toast.success("Entreprise mise à jour");
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const toggleRecruitment = async () => {
    try {
      await api.patch(`/factions/${key}/recruitment`, { recruitment_open: !f.recruitment_open });
      toast.success(`Recrutement ${!f.recruitment_open ? "ouvert" : "fermé"}`);
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const addPosition = () => {
    if (!newPosition.trim()) return;
    setForm((s) => ({ ...s, positions: [...(s.positions || []), newPosition.trim()] }));
    setNewPosition("");
  };
  const removePosition = (i) => {
    setForm((s) => ({ ...s, positions: s.positions.filter((_, idx) => idx !== i) }));
  };

  const reviewSubmit = async (status) => {
    if (!reviewApp) return;
    try {
      await api.patch(`/business-applications/${reviewApp.id}`, { status, admin_note: reviewNote });
      toast.success("Candidature " + (status === "approved" ? "approuvée" : "refusée"));
      setReviewApp(null); setReviewNote("");
      api.get("/business-applications").then((r) => setApps(r.data.filter((a) => a.faction_key === key)));
    } catch (err) { toast.error(formatApiError(err)); }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center text-[#8B949E] font-mono text-sm">Chargement...</div>;
  if (error || !f) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h1 className="font-display text-3xl font-bold">Entreprise Introuvable</h1>
        <p className="text-[#8B949E] mt-3">{error}</p>
        <Link to="/factions"><Button className="mt-6 bg-[#E4B823] text-black hover:bg-[#FCD34D]">Retour aux Entreprises</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-10 py-12" data-testid="entreprise-detail-page">
      <Link to="/factions" className="inline-flex items-center gap-2 text-sm text-[#8B949E] hover:text-[#E4B823]" data-testid="back-to-factions">
        <ArrowLeft size={14} /> Toutes les Entreprises
      </Link>

      {/* Hero */}
      <div className="mt-8 border border-white/10 rounded overflow-hidden bg-[#0C1014]">
        {f.image_url && <img src={f.image_url} alt={f.name} className="w-full aspect-[3/1] object-cover" />}
        <div className="p-8 flex flex-col md:flex-row md:items-center gap-6">
          <div className="w-20 h-20 rounded flex items-center justify-center shrink-0" style={{ background: `${f.color}15`, color: f.color }}>
            <FactionIcon icon_key={f.icon_key} size={36} />
          </div>
          <div className="flex-1">
            <Badge variant="outline" className="border-[#E4B823]/30 text-[#E4B823] text-[10px] uppercase tracking-wider mb-2">{f.category}</Badge>
            <h1 className="font-display text-4xl lg:text-5xl font-bold tracking-tighter">{f.name}</h1>
            {f.owner_username && (
              <div className="mt-3 text-sm text-[#E4B823] flex items-center gap-2 font-mono">
                <Crown size={14} /> Patron : {f.owner_username}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {f.is_whitelist && (
              f.recruitment_open ? (
                <Badge className="bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30 px-3 py-1.5"><Unlock size={12} className="mr-1.5" />Recrutement Ouvert</Badge>
              ) : (
                <Badge className="bg-[#DC2626]/15 text-[#DC2626] border-[#DC2626]/30 px-3 py-1.5"><Lock size={12} className="mr-1.5" />Recrutement Fermé</Badge>
              )
            )}
            {canManage && f.is_whitelist && (
              <div className="flex items-center gap-2 text-xs mt-2">
                <span className="text-[#8B949E]">Recrutement</span>
                <Switch checked={f.recruitment_open} onCheckedChange={toggleRecruitment} data-testid="recruitment-toggle" />
              </div>
            )}
          </div>
        </div>
      </div>

      {canManage && (
        <Tabs defaultValue="presentation" className="mt-8">
          <TabsList className="bg-[#0C1014] border border-white/10 p-1">
            <TabsTrigger value="presentation" data-testid="tab-presentation" className="data-[state=active]:bg-[#E4B823] data-[state=active]:text-black">Présentation</TabsTrigger>
            <TabsTrigger value="manage" data-testid="tab-manage" className="data-[state=active]:bg-[#E4B823] data-[state=active]:text-black"><Pencil size={14} className="mr-2" />Gérer</TabsTrigger>
            {f.is_whitelist && <TabsTrigger value="apps" data-testid="tab-apps" className="data-[state=active]:bg-[#E4B823] data-[state=active]:text-black"><FileText size={14} className="mr-2" />Candidatures ({apps.length})</TabsTrigger>}
          </TabsList>

          <TabsContent value="presentation" className="mt-6">
            <FactionPresentation f={f} />
          </TabsContent>

          <TabsContent value="manage" className="mt-6">
            <div className="border border-white/10 rounded p-6 bg-[#0C1014] space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold flex items-center gap-2"><Pencil size={16} /> Modifier l'Entreprise</h2>
                {!editing
                  ? <Button onClick={() => setEditing(true)} data-testid="edit-faction-btn" className="bg-[#E4B823] text-black hover:bg-[#FCD34D]">Activer l'Édition</Button>
                  : <Button variant="outline" onClick={() => { setEditing(false); setForm(f); }} className="bg-white/5 border-white/15">Annuler</Button>
                }
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Nom</Label>
                  <Input disabled={!editing} value={form?.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    data-testid="faction-edit-name" className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823]" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Catégorie</Label>
                  <Input disabled={!editing} value={form?.category || ""} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    data-testid="faction-edit-category" className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823]" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Couleur (hex)</Label>
                  <div className="flex gap-2 mt-2">
                    <Input disabled={!editing} value={form?.color || ""} onChange={(e) => setForm({ ...form, color: e.target.value })}
                      data-testid="faction-edit-color" className="bg-transparent border-white/10 focus:border-[#E4B823] font-mono" />
                    <div className="w-10 h-10 rounded border border-white/10" style={{ background: form?.color }} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Icône</Label>
                  <select disabled={!editing} value={form?.icon_key || ""} onChange={(e) => setForm({ ...form, icon_key: e.target.value })}
                    data-testid="faction-edit-icon"
                    className="mt-2 w-full bg-transparent border border-white/10 rounded h-10 px-3 text-sm focus:border-[#E4B823] focus:outline-none disabled:opacity-60">
                    {ICON_KEYS.map((k) => <option key={k} value={k} className="bg-[#0C1014]">{k}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Image (URL bannière)</Label>
                  <Input disabled={!editing} value={form?.image_url || ""} onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    placeholder="https://..." data-testid="faction-edit-image"
                    className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823]" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Places Max</Label>
                  <Input disabled={!editing} type="number" min={0} value={form?.slots_max || ""} onChange={(e) => setForm({ ...form, slots_max: e.target.value })}
                    data-testid="faction-edit-slots" className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823]" />
                </div>
              </div>

              <div>
                <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Description</Label>
                <Textarea disabled={!editing} rows={5} value={form?.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  data-testid="faction-edit-description" className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823]" />
              </div>

              {f.is_whitelist && (
                <div>
                  <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Postes Proposés</Label>
                  <div className="mt-2 space-y-2">
                    {(form?.positions || []).map((p, i) => (
                      <div key={i} className="flex items-center gap-2" data-testid={`faction-position-${i}`}>
                        <Input disabled value={p} className="bg-white/5 border-white/10 flex-1" />
                        {editing && <Button size="sm" variant="ghost" onClick={() => removePosition(i)} data-testid={`faction-position-remove-${i}`} className="text-[#DC2626] hover:bg-[#DC2626]/10"><X size={14} /></Button>}
                      </div>
                    ))}
                    {editing && (
                      <div className="flex items-center gap-2">
                        <Input value={newPosition} onChange={(e) => setNewPosition(e.target.value)} placeholder="Nouveau Poste..." data-testid="faction-position-new"
                          className="bg-transparent border-white/10 focus:border-[#E4B823]"
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPosition(); } }} />
                        <Button type="button" onClick={addPosition} data-testid="faction-position-add" className="bg-[#E4B823] text-black hover:bg-[#FCD34D]"><Plus size={14} /></Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {editing && (
                <Button onClick={saveEdits} data-testid="faction-save-btn" className="w-full bg-[#E4B823] text-black hover:bg-[#FCD34D] h-11 font-semibold">
                  <Save size={16} className="mr-2" /> Enregistrer les Modifications
                </Button>
              )}
            </div>
          </TabsContent>

          {f.is_whitelist && (
            <TabsContent value="apps" className="mt-6">
              <div className="border border-white/10 rounded bg-[#0C1014] overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Candidat</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Poste</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Date</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Statut</TableHead>
                      <TableHead className="text-right text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apps.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-[#8B949E] py-8">Aucune Candidature pour cette Entreprise</TableCell></TableRow>
                    ) : apps.map((a) => (
                      <TableRow key={a.id} className="border-white/5 hover:bg-white/5" data-testid={`patron-app-${a.id}`}>
                        <TableCell className="font-medium">{a.username}</TableCell>
                        <TableCell className="text-[#E4B823]">{a.position}</TableCell>
                        <TableCell className="font-mono text-xs text-[#8B949E]">{new Date(a.created_at).toLocaleDateString("fr-BE")}</TableCell>
                        <TableCell><StatusBadge s={a.status} /></TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => { setReviewApp(a); setReviewNote(a.admin_note || ""); }}
                            data-testid={`patron-review-${a.id}`} className="bg-white/5 border-white/10 hover:bg-white/10">
                            Examiner
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          )}
        </Tabs>
      )}

      {!canManage && <div className="mt-8"><FactionPresentation f={f} /></div>}

      <Dialog open={!!reviewApp} onOpenChange={(o) => !o && setReviewApp(null)}>
        <DialogContent className="bg-[#0C1014] border-white/10 max-w-lg">
          {reviewApp && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-xl">{reviewApp.username} — {reviewApp.position}</DialogTitle>
                <DialogDescription>{reviewApp.email} {reviewApp.discord_id && <> · Discord: <code className="text-[#E4B823]">{reviewApp.discord_id}</code></>}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-[#E4B823] mb-1">Motivation</div>
                  <p className="text-white/80 whitespace-pre-wrap">{reviewApp.motivation}</p>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Note</Label>
                  <Textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={3} data-testid="patron-review-note"
                    className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823]" />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => reviewSubmit("rejected")} data-testid="patron-review-reject" className="bg-[#DC2626]/10 border-[#DC2626]/30 text-[#DC2626] hover:bg-[#DC2626]/20">
                  <XCircle size={16} className="mr-2" />Refuser
                </Button>
                <Button onClick={() => reviewSubmit("approved")} data-testid="patron-review-approve" className="bg-[#10B981] text-black hover:bg-[#10B981]/90">
                  <CheckCircle2 size={16} className="mr-2" />Approuver
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FactionPresentation({ f }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 border border-white/10 rounded p-7 bg-[#0C1014]">
        <h2 className="font-display text-2xl font-semibold mb-4">À Propos</h2>
        <p className="text-white/80 leading-relaxed whitespace-pre-wrap">{f.description}</p>
      </div>
      <div className="space-y-4">
        <div className="border border-white/10 rounded p-5 bg-[#0C1014]">
          <div className="text-xs uppercase tracking-[0.2em] text-[#8B949E] mb-3 flex items-center gap-2"><Users size={14} /> Recrutement</div>
          {f.is_whitelist ? (
            <div className="space-y-2 text-sm">
              <div className="text-[#E4B823] font-mono">{f.slots_max ? `0 / ${f.slots_max}` : "—"}</div>
              <div className={`text-xs font-mono uppercase tracking-wider ${f.recruitment_open ? "text-[#10B981]" : "text-[#DC2626]"}`}>
                {f.recruitment_open ? "● Ouvert" : "● Fermé"}
              </div>
            </div>
          ) : (
            <div className="text-sm text-[#8B949E]">Métier Interim — Accessible en Jeu sans Candidature.</div>
          )}
        </div>
        {f.positions?.length > 0 && (
          <div className="border border-white/10 rounded p-5 bg-[#0C1014]">
            <div className="text-xs uppercase tracking-[0.2em] text-[#8B949E] mb-3">Postes Proposés</div>
            <ul className="space-y-2 text-sm">
              {f.positions.map((p, i) => (
                <li key={i} className="flex items-center gap-2 text-white/80"><span className="text-[#E4B823]">▸</span> {p}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
