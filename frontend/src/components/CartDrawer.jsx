import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiError } from "@/lib/api";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Trash2, Plus, Minus, CreditCard, Lock, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export default function CartDrawer() {
  const { items, remove, setQty, total, count, clear } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    if (open) api.get("/shop/settings").then((r) => setSettings(r.data)).catch(() => {});
  }, [open]);

  const disabled = settings && settings.purchases_enabled === false;

  const checkout = async () => {
    if (!user || user === false) {
      setOpen(false);
      toast.info("Connectez-vous pour Finaliser votre Achat");
      navigate("/login");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/shop/checkout", {
        items: items.map((it) => ({ package_id: it.id, quantity: it.quantity })),
        origin_url: window.location.origin,
      });
      clear();
      window.location.href = data.url;
    } catch (err) {
      toast.error(formatApiError(err));
    } finally { setLoading(false); }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button data-testid="cart-trigger" className="relative p-2 rounded hover:bg-white/5 transition-colors" aria-label="Panier">
          <ShoppingCart size={20} className="text-white/80" />
          {count > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 bg-[#E4B823] text-black border-0 text-[10px] font-mono font-bold rounded-full" data-testid="cart-count-badge">
              {count}
            </Badge>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="bg-[#0C1014] border-white/10 w-full sm:max-w-md flex flex-col" data-testid="cart-drawer">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl flex items-center gap-2">
            <ShoppingCart size={20} /> Mon Panier
          </SheetTitle>
          <SheetDescription className="text-[#8B949E] text-xs">
            Vos Achats VIP — Paiement Sécurisé via Stripe
          </SheetDescription>
        </SheetHeader>

        {disabled && (
          <div className="mt-4 border border-[#DC2626]/40 bg-[#DC2626]/5 rounded p-4" data-testid="cart-disabled-banner">
            <div className="flex items-start gap-2 text-[#DC2626]">
              <Lock size={16} className="shrink-0 mt-0.5" />
              <div className="text-sm font-semibold">Boutique Indisponible</div>
            </div>
            <p className="text-xs text-white/70 mt-2">{settings?.disabled_message}</p>
            {settings?.discord_ticket_url && (
              <a href={settings.discord_ticket_url} target="_blank" rel="noreferrer">
                <Button size="sm" className="mt-3 w-full bg-[#5865F2] hover:bg-[#4752C4] text-white" data-testid="cart-ticket-btn">
                  <MessageCircle size={14} className="mr-2" /> Ouvrir un Ticket Discord
                </Button>
              </a>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto -mx-6 px-6 py-4 space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-16" data-testid="cart-empty">
              <ShoppingCart size={48} className="text-[#2D333B] mx-auto" />
              <p className="text-[#8B949E] mt-4 text-sm">Votre Panier est Vide</p>
            </div>
          ) : (
            items.map((it) => (
              <div key={it.id} className="border border-white/10 rounded p-4 bg-[#050608]" data-testid={`cart-item-${it.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="font-display font-semibold">{it.name}</div>
                    <div className="text-xs text-[#E4B823] font-mono mt-1">{it.price.toFixed(2)} € × {it.quantity}</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => remove(it.id)} data-testid={`cart-remove-${it.id}`} className="text-[#DC2626] hover:bg-[#DC2626]/10 -mr-2">
                    <Trash2 size={14} />
                  </Button>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setQty(it.id, it.quantity - 1)} data-testid={`cart-decrement-${it.id}`}
                    className="h-7 w-7 p-0 bg-white/5 border-white/10 hover:bg-white/10" disabled={it.quantity <= 1}>
                    <Minus size={12} />
                  </Button>
                  <span className="font-mono text-sm w-6 text-center" data-testid={`cart-qty-${it.id}`}>{it.quantity}</span>
                  <Button size="sm" variant="outline" onClick={() => setQty(it.id, it.quantity + 1)} data-testid={`cart-increment-${it.id}`}
                    className="h-7 w-7 p-0 bg-white/5 border-white/10 hover:bg-white/10" disabled={it.quantity >= 10}>
                    <Plus size={12} />
                  </Button>
                  <div className="ml-auto font-mono font-bold text-[#E4B823]" data-testid={`cart-line-total-${it.id}`}>
                    {(it.price * it.quantity).toFixed(2)} €
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <SheetFooter className="border-t border-white/10 -mx-6 px-6 pt-6 mt-0 flex-col sm:flex-col gap-4">
            <div className="flex items-center justify-between w-full">
              <span className="text-sm uppercase tracking-[0.2em] text-[#8B949E]">Total</span>
              <span className="font-display font-bold text-2xl text-[#E4B823]" data-testid="cart-total">{total.toFixed(2)} €</span>
            </div>
            <div className="text-xs text-[#8B949E] flex items-center gap-2"><Lock size={12} /> Paiement Sécurisé via Stripe</div>
            <Button onClick={checkout} disabled={loading || disabled} data-testid="cart-checkout-btn" className="w-full bg-[#E4B823] text-black hover:bg-[#FCD34D] h-12 font-semibold disabled:opacity-50">
              <CreditCard size={16} className="mr-2" />
              {disabled ? "Boutique Fermée" : loading ? "Création du Paiement..." : "Procéder au Paiement"}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
