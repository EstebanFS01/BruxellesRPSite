import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Star, Zap, ShoppingCart, AlertCircle, Lock, MessageCircle } from "lucide-react";
import { toast } from "sonner";

const ICON_BY_ID = { citoyen_plus: Star, vip_premium: Zap, vip_or: Crown };
const COLOR_BY_ID = { citoyen_plus: "#8B949E", vip_premium: "#E4B823", vip_or: "#FCD34D" };

export default function Boutique() {
  const [packs, setPacks] = useState([]);
  const [settings, setSettings] = useState(null);
  const { add, items } = useCart();
  const loc = useLocation();

  useEffect(() => {
    api.get("/shop/catalog").then((r) => setPacks(r.data)).catch(() => {});
    api.get("/shop/settings").then((r) => setSettings(r.data)).catch(() => {});
    const params = new URLSearchParams(loc.search);
    if (params.get("payment") === "cancel") {
      toast.info("Paiement Annulé. Votre Panier est Encore Disponible si vous Changez d'Avis.");
    }
  }, [loc.search]);

  const inCart = (id) => items.some((x) => x.id === id);
  const handleAdd = (p) => { add(p); toast.success(`${p.name} Ajouté au Panier`); };
  const disabled = settings && settings.purchases_enabled === false;

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20" data-testid="boutique-page">
      <div className="max-w-2xl">
        <div className="text-xs uppercase tracking-[0.25em] text-[#E4B823] font-medium">// Soutenir le Serveur</div>
        <h1 className="font-display text-5xl lg:text-6xl font-bold tracking-tighter mt-3">Boutique</h1>
        <p className="text-[#8B949E] mt-6 leading-relaxed">
          Soutenez Bruxelles RP et Débloquez des Avantages Cosmétiques Exclusifs. Aucun Pack ne Donne d'Avantage pay-to-win — l'Équilibre du Serveur est notre Priorité.
        </p>
      </div>

      {disabled && (
        <div className="mt-12 border border-[#DC2626]/40 bg-[#DC2626]/5 rounded p-6 flex items-start gap-4" data-testid="shop-disabled-banner">
          <Lock className="text-[#DC2626] shrink-0 mt-0.5" size={22} />
          <div className="flex-1">
            <h3 className="font-display font-semibold text-[#DC2626]">Boutique Temporairement Indisponible</h3>
            <p className="mt-2 text-sm text-white/80">{settings?.disabled_message}</p>
            {settings?.discord_ticket_url && (
              <a href={settings.discord_ticket_url} target="_blank" rel="noreferrer" data-testid="shop-disabled-ticket-btn">
                <Button className="mt-4 bg-[#5865F2] hover:bg-[#4752C4] text-white">
                  <MessageCircle size={16} className="mr-2" /> Ouvrir un Ticket Discord
                </Button>
              </a>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
        {packs.map((p, i) => {
          const Icon = ICON_BY_ID[p.id] || Star;
          const color = COLOR_BY_ID[p.id] || "#E4B823";
          const popular = p.id === "vip_premium";
          const already = inCart(p.id);
          return (
            <div
              key={p.id}
              data-testid={`vip-pack-${p.id}`}
              className={`relative card-hover p-8 rounded border bg-[#0C1014] flex flex-col ${
                popular ? "border-[#E4B823] gold-glow" : "border-white/10"
              }`}
            >
              {popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#E4B823] text-black hover:bg-[#FCD34D] text-[10px] uppercase tracking-[0.2em] font-bold">
                  Le plus Populaire
                </Badge>
              )}
              <div className="w-14 h-14 rounded flex items-center justify-center mb-6" style={{ background: `${color}15`, color }}>
                <Icon size={26} />
              </div>
              <h3 className="font-display font-bold text-2xl">{p.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold text-[#E4B823]">{p.price.toFixed(2)} €</span>
                <span className="text-xs text-[#8B949E] font-mono uppercase tracking-wider">/ {p.duration_days}j</span>
              </div>
              <ul className="mt-8 space-y-3 text-sm flex-1">
                {p.perks.map((t, k) => (
                  <li key={k} className="flex items-start gap-2 text-white/80">
                    <Check size={16} className="text-[#E4B823] mt-0.5 shrink-0" /> {t}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => handleAdd(p)}
                disabled={already || disabled}
                data-testid={`vip-add-${p.id}`}
                className={`w-full mt-8 h-11 ${
                  popular
                    ? "bg-[#E4B823] text-black hover:bg-[#FCD34D]"
                    : "bg-white/5 text-white border border-white/10 hover:bg-white/10"
                }`}
              >
                <ShoppingCart size={14} className="mr-2" />
                {disabled ? "Indisponible" : already ? "Déjà dans le Panier" : "Ajouter au Panier"}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="mt-16 border border-[#E4B823]/30 bg-[#E4B823]/5 rounded p-6 flex items-start gap-4">
        <AlertCircle className="text-[#E4B823] shrink-0 mt-0.5" size={20} />
        <div>
          <h3 className="font-display font-semibold">Paiement Sécurisé</h3>
          <p className="mt-2 text-sm text-[#8B949E]">
            Paiement Traité par Stripe — l'un des Leaders Mondiaux du Paiement en Ligne. Carte bancaire (Visa, Mastercard, Amex) Acceptée. Aucune Donnée Bancaire n'est Stockée sur nos Serveurs.
          </p>
          <p className="mt-2 text-sm text-[#8B949E]">
            Les Avantages VIP sont Activés Automatiquement sur Votre Compte après Confirmation du Paiement.
          </p>
        </div>
      </div>
    </div>
  );
}
