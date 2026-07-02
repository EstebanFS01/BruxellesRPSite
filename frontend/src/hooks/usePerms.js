import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const PERM_LABELS = {
  manage_news:            "📰 Gérer les Actualités",
  manage_whitelist:       "📋 Gérer les Candidatures Whitelist",
  manage_server_settings: "⚙️ Gérer les Paramètres Serveur (WL/FA)",
  manage_entreprises:     "🏢 Gérer les Entreprises (créer, modifier, supprimer)",
  manage_illegal:         "💀 Gérer les Organisations Illégales",
  manage_business:        "💼 Gérer les Candidatures Entreprises & Boutique",
  manage_users:           "👥 Gérer les Utilisateurs",
  manage_admins:          "🛡️ Gérer les Administrateurs",
  view_audit:             "🔍 Voir l'Historique des Actions",
};

export function usePerms() {
  const [data, setData] = useState({ role: null, is_super_admin: false, permissions: [], all_perms: [], loading: true });
  useEffect(() => {
    api.get("/auth/perms")
      .then((r) => setData({ ...r.data, loading: false }))
      .catch(() => setData((d) => ({ ...d, loading: false })));
  }, []);
  const can = (perm) => data.is_super_admin || (data.permissions || []).includes(perm);
  return { ...data, can, PERM_LABELS };
}
