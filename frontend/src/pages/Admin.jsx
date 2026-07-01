import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, CheckCircle2, XCircle, Clock, Shield, Newspaper, FileText, Users as UsersIcon, Briefcase, History, UserCog, Crown, Lock, Unlock, ShoppingCart, BookOpen, Pencil, Settings } from "lucide-react";
import { toast } from "sonner";
import { usePerms } from "@/hooks/usePerms";

function StatusBadge({ s }) {
  if (s === "approved") return <Badge className="bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30"><CheckCircle2 size={12} className="mr-1" /> Approuvée</Badge>;
  if (s === "rejected") return <Badge className="bg-[#DC2626]/15 text-[#DC2626] border-[#DC2626]/30"><XCircle size={12} className="mr-1" /> Refusée</Badge>;
  return <Badge className="bg-[#E4B823]/15 text-[#E4B823] border-[#E4B823]/30"><Clock size={12} className="mr-1" /> En Attente</Badge>;
}

const EMPTY_FACTION = { key: "", name: "", category: "Entreprise", description: "", color: "#E4B823", icon_key: "briefcase", image_url: "", positions: [], slots_max: 20, is_whitelist: true };

export default function Admin() {
  const perms = usePerms();
  const [stats, setStats] = useState(null);
  const [news, setNews] = useState([]);
  const [apps, setApps] = useState([]);
  const [bizApps, setBizApps] = useState([]);
  const [users, setUsers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [audit, setAudit] = useState([]);
  const [factions, setFactions] = useState([]);
  const [shopSettings, setShopSettings] = useState(null);
  const [serverSettings, setServerSettings] = useState(null);
  const [rules, setRules] = useState({ categories: [] });

  const [newsForm, setNewsForm] = useState({ title: "", excerpt: "", content: "", category: "Annonce", image_url: "" });
  const [creating, setCreating] = useState(false);
  const [reviewApp, setReviewApp] = useState(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewBiz, setReviewBiz] = useState(null);
  const [reviewBizNote, setReviewBizNote] = useState("");
  const [newAdmin, setNewAdmin] = useState({ email: "", username: "", password: "", permissions: [] });

  // Faction CRUD state
  const [factionDialog, setFactionDialog] = useState(false);
  const [editingFaction, setEditingFaction] = useState(null);
  const [factionForm, setFactionForm] = useState(EMPTY_FACTION);
  const [factionPositions, setFactionPositions] = useState("");

  // Rules state
  const [rulesEditing, setRulesEditing] = useState(false);
  const [rulesForm, setRulesForm] = useState([]);

  const loadAll = () => {
    api.get("/server/info").then((r) => setStats(r.data)).catch(() => {});
    api.get("/news").then((r) => setNews(r.data)).catch(() => {});
    api.get("/server/settings").then((r) => setServerSettings(r.data)).catch(() => {});
    api.get("/rules").then((r) => setRules(r.data)).catch(() => {});
    if (perms.can("manage_whitelist")) api.get("/applications").then((r) => setApps(r.data)).catch(() => {});
    if (perms.can("manage_business")) api.get("/business-applications").then((r) => setBizApps(r.data)).catch(() => {});
    if (perms.can("manage_business")) api.get("/factions").then((r) => setFactions(r.data)).catch(() => {});
    if (perms.can("manage_users")) api.get("/admin/users").then((r) => setUsers(r.data)).catch(() => {});
    if (perms.can("manage_admins")) api.get("/admin/admins").then((r) => setAdmins(r.data.admins)).catch(() => {});
    if (perms.can("view_audit")) api.get("/admin/audit").then((r) => setAudit(r.data)).catch(() => {});
    if (perms.can("manage_business")) api.get("/shop/settings").then((r) => setShopSettings(r.data)).catch(() => {});
  };

  useEffect(() => { if (!perms.loading) loadAll(); /* eslint-disable-next-line */ }, [perms.loading]);

  // ---- News
  const createNews = async (e) => {
    e.preventDefault(); setCreating(true);
    try {
      await api.post("/news", newsForm); toast.success("Actualité publiée");
      setNewsForm({ title: "", excerpt: "", content: "", category: "Annonce", image_url: "" });
      loadAll();
    } catch (err) { toast.error(formatApiError(err)); } finally { setCreating(false); }
  };
  const deleteNews = async (id) => {
    try { await api.delete(`/news/${id}`); toast.success("Supprimée"); loadAll(); }
    catch (err) { toast.error(formatApiError(err)); }
  };

  // ---- Whitelist review
  const reviewSubmit = async (status) => {
    if (!reviewApp) return;
    try {
      const { data } = await api.patch(`/applications/${reviewApp.id}`, { status, admin_note: reviewNote });
      const msg = status === "approved" ? "Candidature approuvée" : "Candidature Refusée";
      const extra = data?.discord_role_given === true ? " · Rôle Discord Attribué ✓"
                   : data?.discord_role_given === false ? " · Rôle Discord Échec ⚠️" : "";
      toast.success(msg + extra);
      setReviewApp(null); setReviewNote(""); loadAll();
    } catch (err) { toast.error(formatApiError(err)); }
  };
  const deleteApp = async (id) => {
    try { await api.delete(`/applications/${id}`); toast.success("Candidature Supprimée"); loadAll(); }
    catch (err) { toast.error(formatApiError(err)); }
  };

  // ---- Business
  const reviewBizSubmit = async (status) => {
    if (!reviewBiz) return;
    try {
      await api.patch(`/business-applications/${reviewBiz.id}`, { status, admin_note: reviewBizNote });
      toast.success("Candidature " + (status === "approved" ? "Approuvée" : "Refusée"));
      setReviewBiz(null); setReviewBizNote(""); loadAll();
    } catch (err) { toast.error(formatApiError(err)); }
  };
  const deleteBiz = async (id) => {
    try { await api.delete(`/business-applications/${id}`); toast.success("Supprimée"); loadAll(); }
    catch (err) { toast.error(formatApiError(err)); }
  };

  // ---- Factions CRUD
  const openCreateFaction = () => {
    setEditingFaction(null);
    setFactionForm(EMPTY_FACTION);
    setFactionPositions("");
    setFactionDialog(true);
  };
  const openEditFaction = (f) => {
    setEditingFaction(f);
    setFactionForm({ key: f.key, name: f.name, category: f.category, description: f.description, color: f.color || "#E4B823", icon_key: f.icon_key || "briefcase", image_url: f.image_url || "", positions: f.positions || [], slots_max: f.slots_max || 20, is_whitelist: f.is_whitelist !== false });
    setFactionPositions((f.positions || []).join("\n"));
    setFactionDialog(true);
  };
  const saveFaction = async (e) => {
    e.preventDefault();
    const positions = factionPositions.split("\n").map(s => s.trim()).filter(Boolean);
    const payload = { ...factionForm, positions };
    try {
      if (editingFaction) {
        await api.patch(`/factions/${editingFaction.key}`, payload);
        toast.success("Entreprise mise à jour");
      } else {
        await api.post("/factions", payload);
        toast.success("Entreprise créée");
      }
      setFactionDialog(false); loadAll();
    } catch (err) { toast.error(formatApiError(err)); }
  };
  const deleteFaction = async (key) => {
    try { await api.delete(`/factions/${key}`); toast.success("Entreprise supprimée"); loadAll(); }
    catch (err) { toast.error(formatApiError(err)); }
  };
  const setOwner = async (factionKey, userId) => {
    try {
      await api.post(`/admin/factions/${factionKey}/owner`, { user_id: userId || null });
      toast.success(userId ? "Patron Assigné" : "Patron Retiré");
      loadAll();
    } catch (err) { toast.error(formatApiError(err)); }
  };
  const toggleRecruitment = async (key, current) => {
    try {
      await api.patch(`/factions/${key}/recruitment`, { recruitment_open: !current });
      toast.success("Recrutement " + (!current ? "Ouvert" : "Fermé"));
      loadAll();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  // ---- Server settings (WL toggle)
  const updateServerSettings = async (patch) => {
    try {
      const { data } = await api.patch("/server/settings", patch);
      setServerSettings(data);
      toast.success("Paramètres serveur mis à jour");
    } catch (err) { toast.error(formatApiError(err)); }
  };

  // ---- Rules
  const startEditRules = () => {
    setRulesForm(JSON.parse(JSON.stringify(rules.categories || [])));
    setRulesEditing(true);
  };
  const saveRules = async () => {
    try {
      await api.put("/rules", { categories: rulesForm });
      toast.success("Règlement mis à jour");
      setRulesEditing(false);
      loadAll();
    } catch (err) { toast.error(formatApiError(err)); }
  };
  const addRulesCategory = () => setRulesForm(f => [...f, { cat: "Nouvelle Catégorie", items: [] }]);
  const deleteRulesCategory = (ci) => setRulesForm(f => f.filter((_, i) => i !== ci));
  const updateCatName = (ci, val) => setRulesForm(f => f.map((c, i) => i === ci ? { ...c, cat: val } : c));
  const addRulesItem = (ci) => setRulesForm(f => f.map((c, i) => i === ci ? { ...c, items: [...c.items, { q: "Nouvelle règle", a: "Description..." }] } : c));
  const deleteRulesItem = (ci, ii) => setRulesForm(f => f.map((c, i) => i === ci ? { ...c, items: c.items.filter((_, j) => j !== ii) } : c));
  const updateRulesItem = (ci, ii, field, val) => setRulesForm(f => f.map((c, i) => i === ci ? { ...c, items: c.items.map((it, j) => j === ii ? { ...it, [field]: val } : it) } : c));

  // ---- Shop settings
  const saveShopSettings = async (patch) => {
    try {
      const { data } = await api.patch("/shop/settings", patch);
      setShopSettings(data);
      toast.success("Paramètres Boutique Sauvegardés");
    } catch (err) { toast.error(formatApiError(err)); }
  };

  // ---- Users
  const deleteUser = async (id) => {
    try { await api.delete(`/admin/users/${id}`); toast.success("Compte Supprimé"); loadAll(); }
    catch (err) { toast.error(formatApiError(err)); }
  };

  // ---- Admins
  const togglePerm = (perm) => {
    setNewAdmin((s) => ({
      ...s,
      permissions: s.permissions.includes(perm) ? s.permissions.filter((p) => p !== perm) : [...s.permissions, perm],
    }));
  };
  const createAdmin = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/admins", newAdmin);
      toast.success("Administrateur Créé");
      setNewAdmin({ email: "", username: "", password: "", permissions: [] });
      loadAll();
    } catch (err) { toast.error(formatApiError(err)); }
  };
  const updateAdminPerms = async (uid, permissions) => {
    try {
      await api.patch(`/admin/admins/${uid}`, { permissions });
      toast.success("Permissions Mises à Jour");
      loadAll();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  if (perms.loading) return <div className="min-h-[60vh] flex items-center justify-center text-[#8B949E] font-mono text-sm">Chargement...</div>;

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12" data-testid="admin-page">
      <div className="flex items-center gap-3 mb-2">
        <Shield className="text-[#E4B823]" size={20} />
        <span className="text-xs uppercase tracking-[0.25em] text-[#E4B823] font-medium">// Control Room</span>
        {perms.is_super_admin && <Badge className="bg-[#E4B823] text-black ml-2 uppercase tracking-wider text-[10px]">Super-Admin</Badge>}
      </div>
      <h1 className="font-display text-4xl lg:text-5xl font-bold tracking-tighter">Panel Administrateur</h1>

      {/* WL TOGGLE RAPIDE */}
      {perms.can("manage_whitelist") && serverSettings && (
        <div className="mt-6 flex items-center gap-4 border border-white/10 rounded p-4 bg-[#0C1014]">
          <Settings size={16} className="text-[#8B949E]" />
          <span className="text-sm font-medium">Mode Whitelist</span>
          <div className="flex items-center gap-3 ml-auto">
            <span className={`text-xs font-mono ${serverSettings.wl_mode === "fa" ? "text-[#E4B823]" : "text-[#8B949E]"}`}>FA (Libre)</span>
            <Switch
              checked={serverSettings.wl_mode === "wl"}
              onCheckedChange={(v) => updateServerSettings({ wl_mode: v ? "wl" : "fa", whitelist_open: v })}
            />
            <span className={`text-xs font-mono ${serverSettings.wl_mode === "wl" ? "text-[#10B981]" : "text-[#8B949E]"}`}>WL (Candidature)</span>
          </div>
          <Badge className={serverSettings.wl_mode === "wl" ? "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30" : "bg-[#E4B823]/15 text-[#E4B823] border-[#E4B823]/30"}>
            {serverSettings.wl_mode === "wl" ? "Whitelist activée" : "Free Access"}
          </Badge>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-6">
        {[
          { label: "Membres", value: stats?.members ?? "—", icon: UsersIcon },
          { label: "WL en Attente", value: stats?.pending_apps ?? "—", icon: Clock },
          { label: "Whitelistés", value: stats?.whitelisted ?? "—", icon: CheckCircle2 },
          { label: "Entreprises", value: factions.length, icon: Briefcase },
          { label: "Actualités", value: news.length, icon: Newspaper },
        ].map((s, i) => (
          <div key={i} className="border border-white/10 rounded p-5 bg-[#0C1014]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">{s.label}</span>
              <s.icon size={14} className="text-[#8B949E]" />
            </div>
            <div className="font-mono text-3xl font-bold mt-3 text-[#E4B823]">{s.value}</div>
          </div>
        ))}
      </div>

      <Tabs defaultValue={perms.can("manage_whitelist") ? "apps" : perms.can("manage_business") ? "entreprises" : "news"} className="mt-12">
        <TabsList className="bg-[#0C1014] border border-white/10 p-1 flex-wrap h-auto">
          {perms.can("manage_whitelist") && <TabsTrigger value="apps" className="data-[state=active]:bg-[#E4B823] data-[state=active]:text-black"><FileText size={14} className="mr-2" />Whitelist</TabsTrigger>}
          {perms.can("manage_business") && <TabsTrigger value="entreprises" className="data-[state=active]:bg-[#E4B823] data-[state=active]:text-black"><Briefcase size={14} className="mr-2" />Entreprises</TabsTrigger>}
          {perms.can("manage_business") && <TabsTrigger value="biz" className="data-[state=active]:bg-[#E4B823] data-[state=active]:text-black"><Crown size={14} className="mr-2" />Candidatures</TabsTrigger>}
          {perms.can("manage_business") && <TabsTrigger value="patrons" className="data-[state=active]:bg-[#E4B823] data-[state=active]:text-black"><UserCog size={14} className="mr-2" />Patrons</TabsTrigger>}
          {perms.can("manage_news") && <TabsTrigger value="news" className="data-[state=active]:bg-[#E4B823] data-[state=active]:text-black"><Newspaper size={14} className="mr-2" />Actualités</TabsTrigger>}
          {perms.can("manage_news") && <TabsTrigger value="reglement" className="data-[state=active]:bg-[#E4B823] data-[state=active]:text-black"><BookOpen size={14} className="mr-2" />Règlement</TabsTrigger>}
          {perms.can("manage_business") && <TabsTrigger value="shop" className="data-[state=active]:bg-[#E4B823] data-[state=active]:text-black"><ShoppingCart size={14} className="mr-2" />Boutique</TabsTrigger>}
          {perms.can("manage_users") && <TabsTrigger value="users" className="data-[state=active]:bg-[#E4B823] data-[state=active]:text-black"><UsersIcon size={14} className="mr-2" />Utilisateurs</TabsTrigger>}
          {perms.can("manage_admins") && <TabsTrigger value="admins" className="data-[state=active]:bg-[#E4B823] data-[state=active]:text-black"><Shield size={14} className="mr-2" />Admins</TabsTrigger>}
          {perms.can("view_audit") && <TabsTrigger value="audit" className="data-[state=active]:bg-[#E4B823] data-[state=active]:text-black"><History size={14} className="mr-2" />Historique</TabsTrigger>}
        </TabsList>

        {/* WHITELIST */}
        {perms.can("manage_whitelist") && (
          <TabsContent value="apps" className="mt-6">
            <div className="border border-white/10 rounded bg-[#0C1014] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Joueur</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Personnage</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Discord</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Date</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Statut</TableHead>
                    <TableHead className="text-right text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apps.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-[#8B949E] py-8">Aucune Candidature</TableCell></TableRow>
                  ) : apps.map((a) => (
                    <TableRow key={a.id} className="border-white/5 hover:bg-white/5">
                      <TableCell className="font-medium">{a.username}</TableCell>
                      <TableCell>{a.character_name} <span className="text-[#8B949E] text-xs">· {a.age}a</span></TableCell>
                      <TableCell className="font-mono text-xs text-[#8B949E]">{a.discord_id || "—"}</TableCell>
                      <TableCell className="font-mono text-xs text-[#8B949E]">{new Date(a.created_at).toLocaleDateString("fr-BE")}</TableCell>
                      <TableCell><StatusBadge s={a.status} /></TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline" onClick={() => { setReviewApp(a); setReviewNote(a.admin_note || ""); }} className="bg-white/5 border-white/10 hover:bg-white/10">Examiner</Button>
                        {a.status !== "pending" && (<ConfirmDelete onConfirm={() => deleteApp(a.id)} label={`Supprimer la candidature de ${a.character_name} ?`} />)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        )}

        {/* ENTREPRISES CRUD */}
        {perms.can("manage_business") && (
          <TabsContent value="entreprises" className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#8B949E]">Crée, modifie ou supprime les entreprises disponibles sur le serveur.</p>
              <Button onClick={openCreateFaction} className="bg-[#E4B823] text-black hover:bg-[#FCD34D]"><Plus size={16} className="mr-2" />Nouvelle Entreprise</Button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {factions.length === 0 && <div className="text-[#8B949E] text-sm py-8 col-span-2 text-center">Aucune entreprise créée</div>}
              {factions.map((f) => (
                <div key={f.key} className="border border-white/10 rounded bg-[#0C1014] p-5 flex items-start gap-4">
                  <div className="w-2 h-full rounded-full self-stretch" style={{ backgroundColor: f.color || "#E4B823", minHeight: 40, width: 4 }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-semibold">{f.name}</span>
                      <Badge variant="outline" className="text-[10px] border-white/10 text-[#8B949E]">{f.category}</Badge>
                    </div>
                    <p className="text-xs text-[#8B949E] mt-1 line-clamp-2">{f.description}</p>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <span className="text-[10px] font-mono text-[#8B949E]">/{f.key}</span>
                      {f.owner_username && <Badge className="text-[10px] bg-[#E4B823]/10 text-[#E4B823] border-[#E4B823]/20"><Crown size={9} className="mr-1" />{f.owner_username}</Badge>}
                      {f.is_whitelist ? (
                        <button onClick={() => toggleRecruitment(f.key, f.recruitment_open)}>
                          {f.recruitment_open
                            ? <Badge className="text-[10px] bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20"><Unlock size={9} className="mr-1" />Recrutement ouvert</Badge>
                            : <Badge className="text-[10px] bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/20"><Lock size={9} className="mr-1" />Recrutement fermé</Badge>}
                        </button>
                      ) : <Badge className="text-[10px] border-white/10 text-[#8B949E]">Interim</Badge>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openEditFaction(f)} className="bg-white/5 border-white/10 hover:bg-white/10 h-8"><Pencil size={12} className="mr-1" />Modifier</Button>
                    <ConfirmDelete onConfirm={() => deleteFaction(f.key)} label={`Supprimer l'entreprise "${f.name}" et toutes ses candidatures ?`} />
                  </div>
                </div>
              ))}
            </div>

            {/* Dialog création/édition entreprise */}
            <Dialog open={factionDialog} onOpenChange={setFactionDialog}>
              <DialogContent className="bg-[#0C1014] border-white/10 max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-display">{editingFaction ? `Modifier — ${editingFaction.name}` : "Créer une Entreprise"}</DialogTitle>
                  <DialogDescription>Les joueurs pourront postuler pour rejoindre cette entreprise.</DialogDescription>
                </DialogHeader>
                <form onSubmit={saveFaction} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Clé unique (ex: lapd)</Label>
                      <Input required value={factionForm.key} onChange={(e) => setFactionForm({ ...factionForm, key: e.target.value })} disabled={!!editingFaction} className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823] font-mono" placeholder="lapd, boulangerie..." />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Nom</Label>
                      <Input required value={factionForm.name} onChange={(e) => setFactionForm({ ...factionForm, name: e.target.value })} className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823]" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Catégorie</Label>
                      <Input required value={factionForm.category} onChange={(e) => setFactionForm({ ...factionForm, category: e.target.value })} className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823]" placeholder="Entreprise, Police, Gang..." />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Couleur (hex)</Label>
                      <div className="flex gap-2 mt-2">
                        <input type="color" value={factionForm.color} onChange={(e) => setFactionForm({ ...factionForm, color: e.target.value })} className="w-10 h-10 rounded border border-white/10 bg-transparent cursor-pointer" />
                        <Input value={factionForm.color} onChange={(e) => setFactionForm({ ...factionForm, color: e.target.value })} className="bg-transparent border-white/10 focus:border-[#E4B823] font-mono" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Description</Label>
                    <Textarea required rows={3} value={factionForm.description} onChange={(e) => setFactionForm({ ...factionForm, description: e.target.value })} className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823]" />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Image URL (bannière)</Label>
                    <Input value={factionForm.image_url} onChange={(e) => setFactionForm({ ...factionForm, image_url: e.target.value })} className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823]" placeholder="https://..." />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Postes disponibles (un par ligne)</Label>
                    <Textarea rows={4} value={factionPositions} onChange={(e) => setFactionPositions(e.target.value)} className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823] font-mono text-sm" placeholder={"Chauffeur\nMécanicien\nGestionnaire"} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Slots max</Label>
                      <Input type="number" min={0} max={999} value={factionForm.slots_max} onChange={(e) => setFactionForm({ ...factionForm, slots_max: parseInt(e.target.value) || 0 })} className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823]" />
                    </div>
                    <div className="flex items-center gap-3 mt-6">
                      <Switch checked={factionForm.is_whitelist} onCheckedChange={(v) => setFactionForm({ ...factionForm, is_whitelist: v })} />
                      <Label className="text-sm">Whitelist (candidature requise)</Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setFactionDialog(false)} className="border-white/10">Annuler</Button>
                    <Button type="submit" className="bg-[#E4B823] text-black hover:bg-[#FCD34D]">{editingFaction ? "Enregistrer" : "Créer"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </TabsContent>
        )}

        {/* CANDIDATURES ENTREPRISE */}
        {perms.can("manage_business") && (
          <TabsContent value="biz" className="mt-6">
            <div className="border border-white/10 rounded bg-[#0C1014] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Joueur</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Faction</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Poste</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Date</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Statut</TableHead>
                    <TableHead className="text-right text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bizApps.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-[#8B949E] py-8">Aucune Candidature Entreprise</TableCell></TableRow>
                  ) : bizApps.map((a) => (
                    <TableRow key={a.id} className="border-white/5 hover:bg-white/5">
                      <TableCell className="font-medium">{a.username}</TableCell>
                      <TableCell>{a.faction_name}</TableCell>
                      <TableCell className="text-[#E4B823]">{a.position}</TableCell>
                      <TableCell className="font-mono text-xs text-[#8B949E]">{new Date(a.created_at).toLocaleDateString("fr-BE")}</TableCell>
                      <TableCell><StatusBadge s={a.status} /></TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline" onClick={() => { setReviewBiz(a); setReviewBizNote(a.admin_note || ""); }} className="bg-white/5 border-white/10 hover:bg-white/10">Examiner</Button>
                        {a.status !== "pending" && (<ConfirmDelete onConfirm={() => deleteBiz(a.id)} label="Supprimer cette Candidature ?" />)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        )}

        {/* PATRONS */}
        {perms.can("manage_business") && (
          <TabsContent value="patrons" className="mt-6">
            <p className="text-sm text-[#8B949E] mb-4">Assignez un Joueur comme Patron d'une Entreprise.</p>
            <div className="border border-white/10 rounded bg-[#0C1014] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Entreprise</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Patron actuel</TableHead>
                    <TableHead className="text-right text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {factions.map((f) => (
                    <TableRow key={f.key} className="border-white/5 hover:bg-white/5">
                      <TableCell className="font-medium">{f.name} <span className="text-[#8B949E] text-xs">({f.category})</span></TableCell>
                      <TableCell>
                        {f.owner_username
                          ? <span className="text-[#E4B823] flex items-center gap-1.5"><Crown size={12} /> {f.owner_username}</span>
                          : <span className="text-[#8B949E] text-xs italic">Aucun Patron</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <OwnerPicker faction={f} users={users} onSet={(uid) => setOwner(f.key, uid)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        )}

        {/* NEWS */}
        {perms.can("manage_news") && (
          <TabsContent value="news" className="mt-6 space-y-6">
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-[#E4B823] text-black hover:bg-[#FCD34D]"><Plus size={16} className="mr-2" />Nouvelle Actualité</Button>
              </DialogTrigger>
              <DialogContent className="bg-[#0C1014] border-white/10 max-w-xl">
                <DialogHeader>
                  <DialogTitle className="font-display">Publier une Actualité</DialogTitle>
                  <DialogDescription>Visible Immédiatement sur la Page Actualités.</DialogDescription>
                </DialogHeader>
                <form onSubmit={createNews} className="space-y-4">
                  <div><Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Titre</Label>
                    <Input required value={newsForm.title} onChange={(e) => setNewsForm({ ...newsForm, title: e.target.value })} className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823]" /></div>
                  <div><Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Catégorie</Label>
                    <Input required value={newsForm.category} onChange={(e) => setNewsForm({ ...newsForm, category: e.target.value })} className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823]" /></div>
                  <div><Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Image URL</Label>
                    <Input value={newsForm.image_url} onChange={(e) => setNewsForm({ ...newsForm, image_url: e.target.value })} className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823]" /></div>
                  <div><Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Extrait</Label>
                    <Textarea required rows={2} value={newsForm.excerpt} onChange={(e) => setNewsForm({ ...newsForm, excerpt: e.target.value })} className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823]" /></div>
                  <div><Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Contenu</Label>
                    <Textarea required rows={6} value={newsForm.content} onChange={(e) => setNewsForm({ ...newsForm, content: e.target.value })} className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823]" /></div>
                  <Button type="submit" disabled={creating} className="w-full bg-[#E4B823] text-black hover:bg-[#FCD34D]">{creating ? "Publication..." : "Publier"}</Button>
                </form>
              </DialogContent>
            </Dialog>
            <div className="border border-white/10 rounded bg-[#0C1014] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Titre</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Catégorie</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Auteur</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Date</TableHead>
                    <TableHead className="text-right text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {news.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-[#8B949E] py-8">Aucune Actualité</TableCell></TableRow>
                  ) : news.map((n) => (
                    <TableRow key={n.id} className="border-white/5 hover:bg-white/5">
                      <TableCell className="font-medium max-w-xs truncate">{n.title}</TableCell>
                      <TableCell><Badge variant="outline" className="border-[#E4B823]/30 text-[#E4B823] text-[10px]">{n.category}</Badge></TableCell>
                      <TableCell className="text-[#8B949E]">{n.author}</TableCell>
                      <TableCell className="font-mono text-xs text-[#8B949E]">{new Date(n.created_at).toLocaleDateString("fr-BE")}</TableCell>
                      <TableCell className="text-right">
                        <ConfirmDelete onConfirm={() => deleteNews(n.id)} label={`Supprimer "${n.title}" ?`} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        )}

        {/* RÈGLEMENT */}
        {perms.can("manage_news") && (
          <TabsContent value="reglement" className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#8B949E]">Modifie les catégories et règles affichées sur la page Règlement.</p>
              {!rulesEditing
                ? <Button onClick={startEditRules} className="bg-[#E4B823] text-black hover:bg-[#FCD34D]"><Pencil size={14} className="mr-2" />Modifier le Règlement</Button>
                : <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setRulesEditing(false)} className="border-white/10">Annuler</Button>
                    <Button onClick={saveRules} className="bg-[#10B981] text-black hover:bg-[#10B981]/90">Enregistrer</Button>
                  </div>}
            </div>

            {!rulesEditing ? (
              <div className="space-y-3">
                {(rules.categories || []).length === 0 && <div className="text-[#8B949E] text-sm py-8 text-center">Aucune règle — cliquez sur Modifier pour commencer.</div>}
                {(rules.categories || []).map((cat, ci) => (
                  <div key={ci} className="border border-white/10 rounded bg-[#0C1014] p-4">
                    <div className="font-display font-semibold text-[#E4B823] mb-2">{cat.cat}</div>
                    <div className="space-y-2">
                      {(cat.items || []).map((item, ii) => (
                        <div key={ii} className="pl-4 border-l border-white/10">
                          <div className="font-medium text-sm">{item.q}</div>
                          <div className="text-xs text-[#8B949E] mt-0.5">{item.a}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {rulesForm.map((cat, ci) => (
                  <div key={ci} className="border border-white/10 rounded bg-[#0C1014] p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Input value={cat.cat} onChange={(e) => updateCatName(ci, e.target.value)} className="bg-transparent border-white/10 focus:border-[#E4B823] font-display font-semibold" placeholder="Nom de catégorie" />
                      <Button size="sm" variant="ghost" onClick={() => deleteRulesCategory(ci)} className="text-[#DC2626] hover:bg-[#DC2626]/10 shrink-0"><Trash2 size={14} /></Button>
                    </div>
                    {(cat.items || []).map((item, ii) => (
                      <div key={ii} className="pl-4 border-l-2 border-[#E4B823]/30 space-y-2">
                        <div className="flex gap-2 items-start">
                          <div className="flex-1 space-y-2">
                            <Input value={item.q} onChange={(e) => updateRulesItem(ci, ii, "q", e.target.value)} className="bg-transparent border-white/10 focus:border-[#E4B823] text-sm" placeholder="Titre de la règle" />
                            <Textarea rows={2} value={item.a} onChange={(e) => updateRulesItem(ci, ii, "a", e.target.value)} className="bg-transparent border-white/10 focus:border-[#E4B823] text-sm" placeholder="Description..." />
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => deleteRulesItem(ci, ii)} className="text-[#DC2626] hover:bg-[#DC2626]/10 mt-1 shrink-0"><Trash2 size={14} /></Button>
                        </div>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => addRulesItem(ci)} className="border-white/10 text-[#8B949E] hover:bg-white/5 mt-2"><Plus size={12} className="mr-1" />Ajouter une règle</Button>
                  </div>
                ))}
                <Button variant="outline" onClick={addRulesCategory} className="w-full border-dashed border-white/20 text-[#8B949E] hover:bg-white/5"><Plus size={14} className="mr-2" />Ajouter une catégorie</Button>
              </div>
            )}
          </TabsContent>
        )}

        {/* SHOP SETTINGS */}
        {perms.can("manage_business") && (
          <TabsContent value="shop" className="mt-6">
            <ShopSettingsPanel settings={shopSettings} onSave={saveShopSettings} />
          </TabsContent>
        )}

        {/* USERS */}
        {perms.can("manage_users") && (
          <TabsContent value="users" className="mt-6">
            <div className="border border-white/10 rounded bg-[#0C1014] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Pseudo</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Email</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Rôle</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Inscription</TableHead>
                    <TableHead className="text-right text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id} className="border-white/5 hover:bg-white/5">
                      <TableCell className="font-medium">
                        {u.username}
                        {u.is_super_admin && <Badge className="ml-2 bg-[#E4B823] text-black text-[9px]">SUPER</Badge>}
                      </TableCell>
                      <TableCell className="text-[#8B949E] font-mono text-xs">{u.email}</TableCell>
                      <TableCell>
                        {u.role === "admin"
                          ? <Badge className="bg-[#E4B823]/15 text-[#E4B823] border-[#E4B823]/30"><Shield size={10} className="mr-1" />admin</Badge>
                          : <Badge variant="outline" className="border-white/10 text-[#8B949E]">player</Badge>}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-[#8B949E]">{u.created_at ? new Date(u.created_at).toLocaleDateString("fr-BE") : "—"}</TableCell>
                      <TableCell className="text-right">
                        {!u.is_super_admin && (<ConfirmDelete onConfirm={() => deleteUser(u.id)} label={`Supprimer définitivement ${u.username} ?`} />)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        )}

        {/* ADMINS */}
        {perms.can("manage_admins") && (
          <TabsContent value="admins" className="mt-6 space-y-6">
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-[#E4B823] text-black hover:bg-[#FCD34D]"><Plus size={16} className="mr-2" />Créer un Administrateur</Button>
              </DialogTrigger>
              <DialogContent className="bg-[#0C1014] border-white/10 max-w-lg">
                <DialogHeader>
                  <DialogTitle className="font-display">Nouvel Administrateur</DialogTitle>
                  <DialogDescription>Définissez les Accès Accordés à ce Membre du Staff.</DialogDescription>
                </DialogHeader>
                <form onSubmit={createAdmin} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Pseudo</Label>
                      <Input required value={newAdmin.username} onChange={(e) => setNewAdmin({ ...newAdmin, username: e.target.value })} className="mt-2 bg-transparent border-white/10" /></div>
                    <div><Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Email</Label>
                      <Input required type="email" value={newAdmin.email} onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })} className="mt-2 bg-transparent border-white/10" /></div>
                  </div>
                  <div><Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Mot de Passe</Label>
                    <Input required type="password" minLength={6} value={newAdmin.password} onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })} className="mt-2 bg-transparent border-white/10" /></div>
                  <div>
                    <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Permissions Accordées</Label>
                    <div className="mt-3 space-y-3 border border-white/10 rounded p-4">
                      {(perms.all_perms || []).map((p) => (
                        <label key={p} className="flex items-center gap-3 text-sm cursor-pointer">
                          <Checkbox checked={newAdmin.permissions.includes(p)} onCheckedChange={() => togglePerm(p)} className="border-white/20 data-[state=checked]:bg-[#E4B823] data-[state=checked]:border-[#E4B823] data-[state=checked]:text-black" />
                          <span>{perms.PERM_LABELS[p] || p}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" className="bg-[#E4B823] text-black hover:bg-[#FCD34D]">Créer l'Admin</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {admins.map((a) => <AdminCard key={a.id} a={a} allPerms={perms.all_perms} labels={perms.PERM_LABELS} onUpdate={updateAdminPerms} onDelete={deleteUser} canDelete={perms.can("manage_users")} />)}
            </div>
          </TabsContent>
        )}

        {/* AUDIT */}
        {perms.can("view_audit") && (
          <TabsContent value="audit" className="mt-6">
            <div className="border border-white/10 rounded bg-[#0C1014] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Date</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Admin</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Action</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-[0.2em] text-[#8B949E]">Cible</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-[#8B949E] py-8">Aucune Action Enregistrée</TableCell></TableRow>
                  ) : audit.map((e) => (
                    <TableRow key={e.id} className="border-white/5 hover:bg-white/5">
                      <TableCell className="font-mono text-xs text-[#8B949E]">{new Date(e.created_at).toLocaleString("fr-BE")}</TableCell>
                      <TableCell className="font-medium">{e.admin_username}</TableCell>
                      <TableCell><Badge variant="outline" className="border-[#E4B823]/30 text-[#E4B823] text-[10px] font-mono">{e.action}</Badge></TableCell>
                      <TableCell className="text-[#8B949E]">{e.target_label || e.target_id || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* WL Review dialog */}
      <Dialog open={!!reviewApp} onOpenChange={(o) => !o && setReviewApp(null)}>
        <DialogContent className="bg-[#0C1014] border-white/10 max-w-2xl max-h-[90vh] overflow-y-auto">
          {reviewApp && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">{reviewApp.character_name}</DialogTitle>
                <DialogDescription>par {reviewApp.username} · {reviewApp.email} · {reviewApp.age} ans</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <Section title="Background">{reviewApp.background}</Section>
                <Section title="Expérience RP">{reviewApp.rp_experience}</Section>
                <Section title="Motivations">{reviewApp.why_join}</Section>
                <div>
                  <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Note Administrateur</Label>
                  <Textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={3} className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823]" />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => reviewSubmit("rejected")} className="bg-[#DC2626]/10 border-[#DC2626]/30 text-[#DC2626] hover:bg-[#DC2626]/20"><XCircle size={16} className="mr-2" />Refuser</Button>
                <Button onClick={() => reviewSubmit("approved")} className="bg-[#10B981] text-black hover:bg-[#10B981]/90"><CheckCircle2 size={16} className="mr-2" />Approuver</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Business review dialog */}
      <Dialog open={!!reviewBiz} onOpenChange={(o) => !o && setReviewBiz(null)}>
        <DialogContent className="bg-[#0C1014] border-white/10 max-w-lg">
          {reviewBiz && (
            <>
              <DialogHeader>
                <Badge variant="outline" className="border-[#E4B823]/30 text-[#E4B823] text-[10px] w-fit">{reviewBiz.faction_name}</Badge>
                <DialogTitle className="font-display text-xl mt-2">Poste : {reviewBiz.position}</DialogTitle>
                <DialogDescription>par {reviewBiz.username} · {reviewBiz.email}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <Section title="Motivation">{reviewBiz.motivation}</Section>
                <div>
                  <Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Note Admin</Label>
                  <Textarea value={reviewBizNote} onChange={(e) => setReviewBizNote(e.target.value)} rows={3} className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823]" />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => reviewBizSubmit("rejected")} className="bg-[#DC2626]/10 border-[#DC2626]/30 text-[#DC2626] hover:bg-[#DC2626]/20"><XCircle size={16} className="mr-2" />Refuser</Button>
                <Button onClick={() => reviewBizSubmit("approved")} className="bg-[#10B981] text-black hover:bg-[#10B981]/90"><CheckCircle2 size={16} className="mr-2" />Approuver</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.2em] text-[#E4B823] mb-1">{title}</div>
      <p className="text-white/80 whitespace-pre-wrap">{children}</p>
    </div>
  );
}

function ConfirmDelete({ onConfirm, label, testId }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" data-testid={testId} className="text-[#DC2626] hover:text-[#DC2626] hover:bg-[#DC2626]/10">
          <Trash2 size={14} />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-[#0C1014] border-white/10">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">Confirmation</AlertDialogTitle>
          <AlertDialogDescription>{label}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-white/5 border-white/10 hover:bg-white/10">Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-[#DC2626] hover:bg-[#DC2626]/90">Supprimer</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ShopSettingsPanel({ settings, onSave }) {
  const [enabled, setEnabled] = useState(true);
  const [message, setMessage] = useState("");
  const [ticketUrl, setTicketUrl] = useState("");
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (settings) { setEnabled(settings.purchases_enabled); setMessage(settings.disabled_message || ""); setTicketUrl(settings.discord_ticket_url || ""); setDirty(false); }
  }, [settings]);
  if (!settings) return <div className="text-[#8B949E] font-mono text-sm py-12 text-center">Chargement...</div>;
  const toggle = (val) => { setEnabled(val); onSave({ purchases_enabled: val }); };
  const saveText = () => { onSave({ disabled_message: message, discord_ticket_url: ticketUrl }); setDirty(false); };
  return (
    <div className="space-y-6">
      <div className={`border rounded p-6 ${enabled ? "border-[#10B981]/30 bg-[#10B981]/5" : "border-[#DC2626]/40 bg-[#DC2626]/5"}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {enabled ? <Unlock className="text-[#10B981] mt-1" /> : <Lock className="text-[#DC2626] mt-1" />}
            <div>
              <h2 className="font-display text-xl font-semibold">{enabled ? "Achats activés" : "Achats désactivés"}</h2>
              <p className="text-sm text-[#8B949E] mt-2">{enabled ? "Les Joueurs Peuvent Acheter des Packs VIP." : "Les Joueurs Voient un Message les Invitant à Ouvrir un Ticket Discord."}</p>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={toggle} />
        </div>
      </div>
      <div className="border border-white/10 rounded p-6 bg-[#0C1014] space-y-5">
        <h3 className="font-display text-lg font-semibold">Message quand la Boutique est Fermée</h3>
        <div><Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Texte du Message</Label>
          <Textarea rows={3} value={message} onChange={(e) => { setMessage(e.target.value); setDirty(true); }} className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823]" /></div>
        <div><Label className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">URL Discord</Label>
          <Input value={ticketUrl} onChange={(e) => { setTicketUrl(e.target.value); setDirty(true); }} placeholder="https://discord.gg/..." className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823] font-mono" /></div>
        {dirty && <Button onClick={saveText} className="bg-[#E4B823] text-black hover:bg-[#FCD34D]">Enregistrer</Button>}
      </div>
    </div>
  );
}

function OwnerPicker({ faction, users, onSet }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const players = (users || []).filter((u) => u.role === "player" && (u.username.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase())));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10">
          <Crown size={12} className="mr-1.5" />{faction.owner_user_id ? "Changer" : "Assigner"}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#0C1014] border-white/10 max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Assigner un Patron — {faction.name}</DialogTitle>
        </DialogHeader>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un Joueur..." className="bg-transparent border-white/10 focus:border-[#E4B823]" />
        <div className="max-h-72 overflow-y-auto space-y-1">
          {faction.owner_user_id && (
            <button onClick={() => { onSet(null); setOpen(false); }} className="w-full text-left p-3 rounded border border-[#DC2626]/30 bg-[#DC2626]/10 text-[#DC2626] hover:bg-[#DC2626]/20 text-sm">Retirer le Patron Actuel</button>
          )}
          {players.map((u) => (
            <button key={u.id} onClick={() => { onSet(u.id); setOpen(false); }} className="w-full text-left p-3 rounded border border-white/5 hover:border-[#E4B823]/40 hover:bg-white/5 transition-colors">
              <div className="font-medium">{u.username}</div>
              <div className="text-xs text-[#8B949E] font-mono">{u.email}</div>
            </button>
          ))}
          {players.length === 0 && <div className="text-center text-[#8B949E] py-6 text-sm">Aucun Joueur Trouvé</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AdminCard({ a, allPerms, labels, onUpdate, onDelete, canDelete }) {
  const [perms, setPerms] = useState(a.permissions || []);
  const toggle = (p) => setPerms((s) => s.includes(p) ? s.filter((x) => x !== p) : [...s, p]);
  const changed = JSON.stringify((a.permissions || []).slice().sort()) !== JSON.stringify(perms.slice().sort());
  return (
    <div className="border border-white/10 rounded p-5 bg-[#0C1014]">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-display font-semibold text-lg">{a.username} {a.is_super_admin && <Badge className="ml-2 bg-[#E4B823] text-black text-[9px]">SUPER</Badge>}</div>
          <div className="text-xs text-[#8B949E] font-mono">{a.email}</div>
        </div>
        {!a.is_super_admin && canDelete && (<ConfirmDelete onConfirm={() => onDelete(a.id)} label={`Supprimer l'admin ${a.username} ?`} />)}
      </div>
      <div className="mt-4 space-y-2">
        {(allPerms || []).map((p) => (
          <label key={p} className={`flex items-center gap-3 text-sm ${a.is_super_admin ? "opacity-60" : "cursor-pointer"}`}>
            <Checkbox checked={a.is_super_admin || perms.includes(p)} disabled={a.is_super_admin} onCheckedChange={() => toggle(p)} className="border-white/20 data-[state=checked]:bg-[#E4B823] data-[state=checked]:border-[#E4B823] data-[state=checked]:text-black" />
            <span>{labels[p] || p}</span>
          </label>
        ))}
      </div>
      {!a.is_super_admin && changed && (
        <Button onClick={() => onUpdate(a.id, perms)} className="mt-4 w-full bg-[#E4B823] text-black hover:bg-[#FCD34D] h-9 text-sm">Enregistrer les Permissions</Button>
      )}
    </div>
  );
}
