import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

function formatDate(d) {
  return new Date(d).toLocaleDateString("fr-BE", { year: "numeric", month: "long", day: "numeric" });
}

export default function Actualites() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    api.get("/news").then((r) => setNews(r.data)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20" data-testid="actualites-page">
      <div className="max-w-2xl">
        <div className="text-xs uppercase tracking-[0.25em] text-[#E4B823] font-medium">// Journal du Serveur</div>
        <h1 className="font-display text-5xl lg:text-6xl font-bold tracking-tighter mt-3">Actualités</h1>
        <p className="text-[#8B949E] mt-6 leading-relaxed">
          Annonces Officielles, Mises à Jour, Événements et Actualités.
        </p>
      </div>

      {loading ? (
        <div className="mt-16 text-[#8B949E] font-mono text-sm">Chargement...</div>
      ) : news.length === 0 ? (
        <div className="mt-16 text-[#8B949E] font-mono text-sm" data-testid="news-empty">Aucune Actualité pour le Moment.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-14">
          {news.map((n, i) => (
            <button
              key={n.id}
              onClick={() => setOpen(n)}
              data-testid={`news-card-${i}`}
              className="card-hover text-left border border-white/10 rounded overflow-hidden bg-[#0C1014]"
            >
              {n.image_url && (
                <div className="aspect-[16/10] overflow-hidden">
                  <img src={n.image_url} alt={n.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-[#E4B823]/30 text-[#E4B823]">{n.category}</Badge>
                  <span className="text-xs text-[#8B949E] font-mono">{formatDate(n.created_at)}</span>
                </div>
                <h3 className="font-display font-semibold text-lg mt-3 leading-snug">{n.title}</h3>
                <p className="text-sm text-[#8B949E] mt-2 line-clamp-3">{n.excerpt}</p>
                <div className="mt-4 text-xs text-[#E4B823] font-mono uppercase tracking-wider">Lire l'article →</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="bg-[#0C1014] border-white/10 max-w-2xl" data-testid="news-dialog">
          {open && (
            <>
              {open.image_url && <img src={open.image_url} alt={open.title} className="w-full aspect-video object-cover rounded -mt-2" />}
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <Badge variant="outline" className="border-[#E4B823]/30 text-[#E4B823] text-[10px] uppercase tracking-wider">{open.category}</Badge>
                  <span className="text-xs text-[#8B949E] font-mono">{formatDate(open.created_at)} · par {open.author}</span>
                </div>
                <DialogTitle className="font-display text-2xl">{open.title}</DialogTitle>
                <DialogDescription className="text-[#8B949E]">{open.excerpt}</DialogDescription>
              </DialogHeader>
              <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{open.content}</div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
