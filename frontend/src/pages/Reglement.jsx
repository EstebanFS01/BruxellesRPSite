import { useEffect, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { api } from "@/lib/api";

const DEFAULT_RULES = [
  {
    cat: "Règles Générales",
    items: [
      { q: "Respect de la communauté", a: "Aucun comportement toxique, raciste, sexiste ou homophobe ne sera toléré. Le respect entre joueurs est obligatoire, en RP comme en OOC." },
      { q: "Pseudonymes & identité", a: "Votre nom de personnage doit être réaliste (Prénom Nom). Pas de noms farfelus, de célébrités ou de mèmes." },
      { q: "Discord obligatoire", a: "La connexion au Discord BXL-RP est obligatoire pour rejoindre le serveur. TeamSpeak n'est pas utilisé." },
    ],
  },
  {
    cat: "RôlePlay (RP)",
    items: [
      { q: "PowerGaming (PG)", a: "Interdit. Vous ne pouvez pas effectuer des actions impossibles dans la vraie vie (sauter d'un immeuble, encaisser 10 balles, etc.)." },
      { q: "MetaGaming (MG)", a: "Interdit d'utiliser des informations hors-RP (Discord, stream) dans votre RP." },
      { q: "Fail RP", a: "Tout comportement non réaliste qui brise l'immersion est sanctionné. Votre personnage doit ressentir la peur, la douleur et agir en conséquence." },
      { q: "Règle du nouveau (NLR)", a: "Après une mort, vous ne pouvez pas revenir dans la zone du décès pendant 15 minutes et oubliez les circonstances de votre mort." },
    ],
  },
  {
    cat: "Combat & Criminalité",
    items: [
      { q: "RDM (Random Death Match)", a: "Interdit de tuer sans raison RP valable. Tout meurtre doit être justifié dans le contexte." },
      { q: "VDM (Vehicle Death Match)", a: "Interdit d'utiliser son véhicule comme arme pour tuer ou blesser sans contexte RP." },
      { q: "Braquages", a: "Maximum 3 personnes pour un braquage de petit commerce, 6 pour une banque. Toujours laisser une porte de sortie RP aux victimes." },
      { q: "Kidnapping", a: "Autorisé avec un motif RP. Maximum 2h de détention. Demandes de rançon réalistes uniquement." },
    ],
  },
  {
    cat: "Véhicules & Possessions",
    items: [
      { q: "Vol de véhicule", a: "Maximum 1 véhicule volé par jour par joueur. Les véhicules de service (LSPD, EMS) sont interdits au vol." },
      { q: "Argent IRL", a: "Strictement interdit d'échanger de l'argent réel contre de l'argent ou des biens RP. Sanction immédiate." },
    ],
  },
  {
    cat: "Sanctions",
    items: [
      { q: "Système d'avertissement", a: "1er avertissement = warn. 3 warns = ban 24h. 5 warns = ban 7 jours. Cas grave = ban définitif." },
      { q: "Appel d'une sanction", a: "Vous pouvez faire appel sur le Discord dans la catégorie #appels-sanctions. Un staff vous répondra sous 48h." },
    ],
  },
];

export default function Reglement() {
  const [categories, setCategories] = useState(null);

  useEffect(() => {
    api.get("/rules")
      .then((r) => {
        if (r.data?.categories?.length > 0) {
          setCategories(r.data.categories);
        } else {
          setCategories(DEFAULT_RULES);
        }
      })
      .catch(() => setCategories(DEFAULT_RULES));
  }, []);

  const rules = categories || DEFAULT_RULES;

  return (
    <div className="max-w-4xl mx-auto px-6 lg:px-10 py-20" data-testid="reglement-page">
      <div className="text-xs uppercase tracking-[0.25em] text-[#E4B823] font-medium">// Règles du serveur</div>
      <h1 className="font-display text-5xl lg:text-6xl font-bold tracking-tighter mt-3">Règlement</h1>
      <p className="text-[#8B949E] mt-6 leading-relaxed">
        Le Règlement Complet de Bruxelles RôlePlay. Sa Lecture est Obligatoire Avant de Jouer. Toute Infraction est Sanctionnée par Notre Équipe Staff.
      </p>

      {!categories && (
        <div className="mt-14 text-[#8B949E] font-mono text-sm animate-pulse">Chargement du règlement...</div>
      )}

      <div className="mt-14 space-y-10">
        {rules.map((section, si) => (
          <section key={si} data-testid={`rules-section-${si}`}>
            <h2 className="font-display text-2xl font-semibold mb-4 flex items-center gap-3">
              <span className="text-[#E4B823] font-mono text-sm">0{si + 1}</span> {section.cat}
            </h2>
            <Accordion type="single" collapsible className="border border-white/10 rounded bg-[#0C1014] px-6">
              {(section.items || []).map((it, i) => (
                <AccordionItem key={i} value={`${si}-${i}`} className="border-white/5">
                  <AccordionTrigger className="text-left hover:no-underline hover:text-[#E4B823]" data-testid={`rule-trigger-${si}-${i}`}>
                    {it.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-[#8B949E] leading-relaxed">
                    {it.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        ))}
      </div>
    </div>
  );
}
