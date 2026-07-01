import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, XCircle, Shield, User as UserIcon, Crown, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function Dashboard() {
  const { user, refresh } = useAuth();
  const [mine, setMine] = useState([]);
  const [bizMine, setBizMine] = useState([]);
  const [myFactions, setMyFactions] = useState([]);
  const [info, setInfo] = useState(null);
  const [orders, setOrders] = useState([]);
  const [paymentStatus, setPaymentStatus] = useState(null); // {status, attempts}
  const loc = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/applications/mine").then((r) => setMine(r.data)).catch(() => {});
    api.get("/business-applications/mine").then((r) => setBizMine(r.data)).catch(() => {});
    api.get("/factions/mine").then((r) => setMyFactions(r.data)).catch(() => {});
    api.get("/server/info").then((r) => setInfo(r.data)).catch(() => {});
    api.get("/shop/orders/mine").then((r) => setOrders(r.data)).catch(() => {});
  }, []);

  // Poll payment status if returning from Stripe
  useEffect(() => {
    const params = new URLSearchParams(loc.search);
    const sid = params.get("session_id");
    if (!sid) return;

    let attempts = 0;
    let stopped = false;
    setPaymentStatus({ status: "checking" });

    const poll = async () => {
      if (stopped) return;
      attempts += 1;
      try {
        const { data } = await api.get(`/shop/status/${sid}`);
        if (data.payment_status === "paid") {
          setPaymentStatus({ status: "paid", amount: data.amount_total, currency: data.currency });
          toast.success("Paiement Confirmé ! Vos Avantages VIP sont Activés.");
          api.get("/shop/orders/mine").then((r) => setOrders(r.data));
          refresh?.();
          navigate("/dashboard", { replace: true });
          return;
        }
        if (data.status === "expired" || data.payment_status === "failed") {
          setPaymentStatus({ status: "failed" });
          toast.error("Paiement Échoué ou Expiré.");
          navigate("/dashboard", { replace: true });
          return;
        }
        if (attempts >= 6) {
          setPaymentStatus({ status: "timeout" });
          toast.info("Vérification du Paiement en Cours. Recharge la Page dans Quelques Instants.");
          navigate("/dashboard", { replace: true });
          return;
        }
        setTimeout(poll, 2000);
      } catch {
        if (attempts < 6) setTimeout(poll, 2500);
      }
    };
    poll();
    return () => { stopped = true; };
  }, [loc.search, navigate, refresh]);

  const status = (s) => {
    if (s === "approved") return <Badge className="bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30"><CheckCircle2 size={12} className="mr-1" /> Approuvée</Badge>;
    if (s === "rejected") return <Badge className="bg-[#DC2626]/15 text-[#DC2626] border-[#DC2626]/30"><XCircle size={12} className="mr-1" /> Refusée</Badge>;
    return <Badge className="bg-[#E4B823]/15 text-[#E4B823] border-[#E4B823]/30"><Clock size={12} className="mr-1" /> En Attente</Badge>;
  };

  const isWhitelisted = mine.some((a) => a.status === "approved");

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20" data-testid="dashboard-page">
      {paymentStatus?.status === "checking" && (
        <div className="mb-8 border border-[#E4B823]/30 bg-[#E4B823]/5 rounded p-5 flex items-center gap-4" data-testid="payment-checking">
          <Sparkles className="text-[#E4B823] animate-pulse" />
          <div>
            <div className="font-display font-semibold">Vérification du Paiement en Cours...</div>
            <div className="text-xs text-[#8B949E] mt-1 font-mono">Ne Ferme pas Cette Page</div>
          </div>
        </div>
      )}
      {paymentStatus?.status === "paid" && (
        <div className="mb-8 border border-[#10B981]/40 bg-[#10B981]/5 rounded p-5 flex items-center gap-4" data-testid="payment-success">
          <CheckCircle2 className="text-[#10B981]" size={28} />
          <div>
            <div className="font-display font-semibold text-[#10B981]">Paiement Confirmé !</div>
            <div className="text-xs text-[#8B949E] mt-1">Tes Avantages VIP sont Actifs sur ton Compte.</div>
          </div>
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-[#E4B823] font-medium">// Mon Espace</div>
          <h1 className="font-display text-5xl font-bold tracking-tighter mt-3">Bonjour {user?.username}</h1>
          <p className="text-[#8B949E] mt-3 font-mono text-sm">{user?.email}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {user?.role === "admin" && (
            <Link to="/admin"><Button className="bg-[#E4B823] text-black hover:bg-[#FCD34D]" data-testid="dashboard-admin-btn"><Shield size={16} className="mr-2" />Panel Admin</Button></Link>
          )}
          <Link to="/profile"><Button variant="outline" className="border-white/15 bg-white/5 hover:bg-white/10" data-testid="dashboard-profile-btn"><UserIcon size={16} className="mr-2" />Mon Personnage</Button></Link>
          <Link to="/candidature"><Button variant="outline" className="border-white/15 bg-white/5 hover:bg-white/10" data-testid="dashboard-apply-btn">Nouvelle Candidature</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-12">
        <div className="border border-white/10 rounded p-6 bg-[#0C1014]" data-testid="stat-status">
          <div className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Statut</div>
          <div className="mt-3 font-display text-2xl font-semibold">
            {isWhitelisted ? <span className="text-[#10B981]">Whitelisté</span> : <span className="text-[#E4B823]">Visiteur</span>}
          </div>
        </div>
        <div className="border border-white/10 rounded p-6 bg-[#0C1014]" data-testid="stat-role">
          <div className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Rôle</div>
          <div className="mt-3 font-display text-2xl font-semibold capitalize flex items-center gap-2">
            {user?.role === "admin" ? <Shield size={20} className="text-[#E4B823]" /> : <UserIcon size={20} />}
            {user?.role}
          </div>
        </div>
        <div className="border border-white/10 rounded p-6 bg-[#0C1014]" data-testid="stat-vip">
          <div className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">VIP</div>
          <div className="mt-3 font-display text-2xl font-semibold flex items-center gap-2">
            {user?.vip_tier ? (
              <>
                <Sparkles size={18} className="text-[#E4B823]" />
                <span className="text-[#E4B823]">{user.vip_tier}</span>
              </>
            ) : <span className="text-[#8B949E]">Aucun</span>}
          </div>
          {user?.vip_until && (
            <div className="text-[10px] text-[#8B949E] font-mono mt-1">Jusqu'au {new Date(user.vip_until).toLocaleDateString("fr-BE")}</div>
          )}
        </div>
        <div className="border border-white/10 rounded p-6 bg-[#0C1014]" data-testid="stat-connect">
          <div className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Connexion Serveur</div>
          <div className="mt-3 font-mono text-sm text-[#E4B823] truncate">{info?.connect}</div>
        </div>
      </div>

      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold mb-6">Mes Candidatures Whitelist</h2>
        {mine.length === 0 ? (
          <div className="border border-dashed border-white/10 rounded p-12 text-center" data-testid="dashboard-empty-apps">
            <p className="text-[#8B949E]">Vous n'Avez pas Encore de Candidature.</p>
            <Link to="/candidature"><Button className="mt-4 bg-[#E4B823] text-black hover:bg-[#FCD34D]">Postuler Maintenant</Button></Link>
          </div>
        ) : (
          <div className="space-y-3">
            {mine.map((a, i) => (
              <div key={a.id} className="border border-white/10 rounded p-6 bg-[#0C1014] flex items-start justify-between gap-4" data-testid={`dashboard-app-${i}`}>
                <div className="flex-1">
                  <div className="font-display font-semibold text-lg">{a.character_name} <span className="text-[#8B949E] font-normal text-sm">· {a.age} ans</span></div>
                  <div className="text-xs text-[#8B949E] font-mono mt-1">{new Date(a.created_at).toLocaleString("fr-BE")}</div>
                  <p className="text-sm text-[#8B949E] mt-3 line-clamp-2">{a.background}</p>
                  {a.admin_note && (
                    <div className="mt-3 text-sm text-white/70 italic border-l-2 border-[#E4B823]/40 pl-3">"{a.admin_note}"</div>
                  )}
                </div>
                {status(a.status)}
              </div>
            ))}
          </div>
        )}
      </section>

      {myFactions.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-semibold mb-6 flex items-center gap-2"><Crown size={20} className="text-[#E4B823]" /> Mes Entreprises</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myFactions.map((f, i) => (
              <Link key={f.key} to={`/entreprise/${f.key}`} data-testid={`dashboard-owned-${i}`}
                className="card-hover p-6 border border-[#E4B823]/30 rounded bg-[#0C1014] block">
                <div className="flex items-start justify-between">
                  <div className="font-display font-semibold text-lg">{f.name}</div>
                  {f.recruitment_open
                    ? <Badge className="bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30 text-[9px] uppercase">Ouvert</Badge>
                    : <Badge className="bg-[#DC2626]/15 text-[#DC2626] border-[#DC2626]/30 text-[9px] uppercase">Fermé</Badge>}
                </div>
                <p className="text-sm text-[#8B949E] mt-2 line-clamp-2">{f.description}</p>
                <div className="mt-4 text-xs text-[#E4B823] font-mono uppercase tracking-wider">Gérer →</div>
              </Link>
            ))}
          </div>
        </section>
      )}


      {bizMine.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-semibold mb-6">Mes Candidatures Entreprises</h2>
          <div className="space-y-3">
            {bizMine.map((a, i) => (
              <div key={a.id} className="border border-white/10 rounded p-6 bg-[#0C1014] flex items-start justify-between gap-4" data-testid={`dashboard-biz-${i}`}>
                <div className="flex-1">
                  <div className="font-display font-semibold text-lg">{a.faction_name} <span className="text-[#E4B823] font-normal text-sm">· {a.position}</span></div>
                  <div className="text-xs text-[#8B949E] font-mono mt-1">{new Date(a.created_at).toLocaleString("fr-BE")}</div>
                  <p className="text-sm text-[#8B949E] mt-3 line-clamp-2">{a.motivation}</p>
                  {a.admin_note && (
                    <div className="mt-3 text-sm text-white/70 italic border-l-2 border-[#E4B823]/40 pl-3">"{a.admin_note}"</div>
                  )}
                </div>
                {status(a.status)}
              </div>
            ))}
          </div>
        </section>
      )}

      {orders.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-semibold mb-6 flex items-center gap-2"><Sparkles size={20} className="text-[#E4B823]" /> Mes Commandes VIP</h2>
          <div className="border border-white/10 rounded bg-[#0C1014] overflow-hidden">
            {orders.map((o, i) => {
              const paid = o.payment_status === "paid";
              return (
                <div key={o.id || o.session_id} className="p-5 border-b border-white/5 last:border-0 flex items-start justify-between gap-4" data-testid={`order-${i}`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {(o.items || []).map((it, k) => (
                        <Badge key={k} variant="outline" className="border-[#E4B823]/30 text-[#E4B823] text-xs">
                          {it.name} × {it.quantity}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-[#8B949E] font-mono">{new Date(o.created_at).toLocaleString("fr-BE")} · {o.session_id?.slice(-12)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display font-bold text-lg text-[#E4B823]">{o.amount?.toFixed(2)} €</div>
                    {paid
                      ? <Badge className="bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30 mt-1 text-[10px]">Payé</Badge>
                      : <Badge className="bg-[#E4B823]/15 text-[#E4B823] border-[#E4B823]/30 mt-1 text-[10px]">{o.payment_status || "En Attente"}</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

    </div>
  );
}
