# BXL-RP — Bruxelles RôlePlay

## Original Problem Statement
> "fait moi un site pour mon serveur FiveM Belge"

## User Choices
- Server name: **Bruxelles RôlePlay** (Belgique)
- Sections: tout ce que l'agent juge utile
- Auth: compte joueur + panel admin
- Discord link
- Style: moderne

## Architecture
- **Backend**: FastAPI + MongoDB (motor). JWT cookies httpOnly, bcrypt hashing, role-based access (player/admin).
- **Frontend**: React 19 + React Router 7 + Tailwind + Shadcn UI + Framer Motion + react-fast-marquee + Phosphor/Lucide icons.
- **Design**: Luxury dark theme (#050608 / #E4B823), Outfit + Manrope + JetBrains Mono fonts, Belgian flag accent strip.

## User Personas
- **Visiteur**: découvre le serveur, lit règlement, voit factions et news, copie l'IP.
- **Joueur (player)**: créé son compte, postule whitelist, suit sa candidature.
- **Admin**: gère news, approuve/refuse candidatures, voit la liste des membres.

## Implemented (2026-06-29)
- Landing immersive avec hero Bruxelles, stats live, factions preview, news preview, CTA
- Pages: /factions (12 organisations), /actualites (avec dialog détail), /reglement (accordéons), /boutique (3 packs VIP)
- Auth complète: register, login, logout, /me, cookies httpOnly, JWT
- Whitelist: candidature joueur + review admin (approuver/refuser + note)
- Admin panel: stats temps réel, gestion news (CRUD), gestion candidatures, liste utilisateurs
- Dashboard joueur: statut whitelist, candidatures, connexion serveur
- Discord link partout, IP de connexion copiable
- Admin seedé automatiquement, 3 news samples seedées

## Implemented Iteration 2 (2026-06-29)
- **Discord webhook**: notification staff automatique sur soumission + review de candidature (embeds couleur, fields, footer)
- **Profil personnage** (/profile, edit): photo, nom, profession, faction, adresse, téléphone IC, statut (vivant/en fuite/décédé/inconnu), bio, compétences, casier, date naissance IC, toggle public/privé
- **Annuaire joueurs** (/joueurs): cartes des profils publics + recherche live
- **Profil public** (/joueurs/{username}): vue détaillée avec sidebar (profession, adresse, téléphone), bio, compétences, casier
- Auto-création du profil au premier accès

## Implemented Iteration 6 (2026-06-29)
- **Kill-switch boutique** : toggle dans le panel admin (onglet "Boutique") qui désactive globalement les achats VIP
- **Message personnalisable** + URL Discord configurable (validation http/https — anti-XSS)
- **UX joueur** : banner rouge sur `/boutique`, banner dans le panier, boutons "Ajouter" + "Procéder au paiement" désactivés, lien direct "Ouvrir un ticket Discord"
- **Backend** : POST /api/shop/checkout renvoie 400 avec le message custom si désactivé
- **Audit log** : action `shop_settings_updated` tracée
- Tests : backend 100% (9/9) + frontend 100% (8/8 E2E)

## Implemented Iteration 5 (2026-06-29)
- **Boutique activée** : catalogue VIP en API (3 packs : Citoyen+ 5€, VIP Premium 15€, VIP Or 30€)
- **Panier** (CartContext) persisté en localStorage, accessible depuis l'icône panier dans la navbar (badge avec count). Drawer avec quantité +/-, suppression, total live
- **Paiement Stripe Checkout** via `emergentintegrations` :
  - Montant calculé côté serveur (anti-tampering)
  - origin_url forcé sur FRONTEND_URL (fix open-redirect)
  - Transaction MongoDB créée AVANT redirection
  - Polling du statut depuis /dashboard?session_id=
  - Webhook /api/webhook/stripe (best-effort)
- **VIP perks** : `vip_tier` + `vip_until` ajoutés au User, calcul du tier le plus haut (TIER_RANK), idempotent (perks_granted flag)
- **Dashboard** : tile "VIP" avec tier + date d'expiration, section "Mes commandes VIP", banner "Paiement confirmé"
- Tests : backend 100% (15/15 pytest) + frontend 100% (13/13 E2E avec redirection Stripe réelle)

## Implemented Iteration 4 (2026-06-29)
- **Factions DB-backed** : 12 factions seedées (LSPD, Justice, EMS, Pompiers, Gouvernement, Le Soir, Mécano, Transport, Resto, BTP, ULB, Banque) avec key, category, color, icon_key, positions, slots_max, is_whitelist, recruitment_open, owner_user_id
- **Patrons d'entreprise** : un admin assigne un joueur comme `owner_user_id` d'une faction. Le patron peut :
  - Modifier la page de son entreprise (nom, catégorie, description, couleur, icône, image, postes, slots)
  - Ouvrir/fermer le recrutement via toggle
  - Examiner uniquement les candidatures de SA faction (RBAC strict)
- **Page entreprise** (`/entreprise/{key}`) : hero + 3 onglets (Présentation / Gérer / Candidatures) visibles pour patron+admin uniquement, sinon vue publique propre
- **Tab "Patrons" du panel admin** : assignation/retrait du patron via dialog avec recherche joueur, toggle recrutement en un clic
- **Dashboard joueur** : section "Mes entreprises" pour les patrons (lien direct vers leur page de gestion)
- **Candidatures bloquées** quand recrutement fermé (400 côté API, UI grise le bouton "Postuler")

## Implemented Iteration 3 (2026-06-29)
- **RBAC granulaire** : 6 permissions (manage_news, manage_whitelist, manage_business, manage_users, manage_admins, view_audit). Super-admin auto-promu au boot.
- **Gestion admins** : créer/lister/modifier sub-admins avec checkboxes de permissions. Super-admin verrouillé.
- **Suppression comptes** : cascade delete (profil + candidatures WL + candidatures entreprises). Guard self & super-admin.
- **Suppression candidatures** : disponible une fois reviewées (pas en pending).
- **Candidatures entreprises** : par faction whitelist (LSPD, EMS, Mécano, Gouvernement, Média, Banque, Justice, Pompiers) avec poste + motivation. CRUD complet admin.
- **Historique** : `audit_log` collection avec toutes les actions admin (qui, quoi, quand, cible).
- **Discord bot** : assignation automatique du rôle WL au moment de l'approbation (si Discord ID fourni à la candidature). Best-effort, n'impacte pas l'API.
- **Discord ID** : champ ajouté à la candidature, transmis dans le webhook staff.

## Implemented Iteration 2 (2026-06-29)
- **Discord webhook**: notification staff automatique sur soumission + review de candidature
- **Profil personnage** + annuaire `/joueurs`

## Backlog (P1/P2)
- P1: Module paiement Stripe pour boutique VIP
- P1: Page profil personnage (vehicules, argent IRL stats)
- P2: Forum communautaire (threads + replies)
- P2: Classement joueurs/staff
- P2: Webhook Discord vers admin pour nouvelles candidatures
- P2: Upload d'image custom pour news (au lieu d'URL)
- P2: Système d'événements (calendrier)

## Test Credentials
- Admin: `admin@bxlrp.be` / `BxlRP2026!`
- DB: `bxlrp_database`
