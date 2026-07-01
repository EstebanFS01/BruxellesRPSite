# Guide d'hébergement gratuit — BXRP

Stack : Frontend React → **Vercel** · Backend FastAPI → **Render** · Base de données → **MongoDB Atlas**

Le paiement Stripe est désactivé par défaut (le backend démarre sans planter, la route paiement renverra juste une erreur 503 tant que tu ne l'actives pas). Tu pourras l'activer plus tard en suivant la section tout en bas.

---

## Étape 0 — Mettre le code sur GitHub

1. Crée un nouveau repo sur https://github.com/new (ex: `bxrp-site`), **public ou privé**, sans rien cocher (pas de README).
2. Sur ton ordinateur, dans le dossier du projet dézippé :
```bash
git init
git add .
git commit -m "Premier commit"
git branch -M main
git remote add origin https://github.com/TON-PSEUDO/bxrp-site.git
git push -u origin main
```

---

## Étape 1 — Base de données : MongoDB Atlas (gratuit)

1. Va sur https://www.mongodb.com/cloud/atlas/register et crée un compte.
2. Crée un cluster **gratuit (M0)**.
3. Dans **Database Access** : crée un utilisateur (note bien le user/password).
4. Dans **Network Access** : clique "Add IP Address" → "Allow access from anywhere" (`0.0.0.0/0`).
5. Clique "Connect" → "Drivers" → copie l'URI de connexion (ressemble à `mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`). C'est ton `MONGO_URL`.

---

## Étape 2 — Backend : Render (gratuit)

1. Va sur https://render.com et connecte-toi avec GitHub.
2. "New" → "Web Service" → choisis ton repo `bxrp-site`.
3. Render devrait détecter `render.yaml` automatiquement. Sinon configure manuellement :
   - **Root Directory** : `backend`
   - **Runtime** : Python 3
   - **Build Command** : `pip install -r requirements.txt`
   - **Start Command** : `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - **Plan** : Free
4. Dans "Environment", ajoute ces variables (voir `backend/.env.example`) :
   - `MONGO_URL` = l'URI copiée à l'étape 1
   - `DB_NAME` = `bxrp`
   - `JWT_SECRET` = une longue chaîne aléatoire (Render peut la générer automatiquement)
   - `CORS_ORIGINS` = laisse vide pour l'instant, tu la rempliras à l'étape 4
5. Clique "Create Web Service". Note l'URL générée, ex : `https://bxrp-backend.onrender.com`.

⚠️ Le plan gratuit Render "s'endort" après 15 min d'inactivité (le premier visiteur attend ~30s que ça redémarre). C'est normal sur le plan gratuit.

---

## Étape 3 — Frontend : Vercel (gratuit)

1. Va sur https://vercel.com et connecte-toi avec GitHub.
2. "Add New" → "Project" → sélectionne ton repo.
3. Configure :
   - **Root Directory** : `frontend`
   - **Framework Preset** : Create React App
   - **Build Command** : `yarn build` (par défaut, OK)
   - **Output Directory** : `build`
4. Dans "Environment Variables", ajoute :
   - `REACT_APP_BACKEND_URL` = l'URL Render de l'étape 2 (ex : `https://bxrp-backend.onrender.com`, **sans** `/api` à la fin)
5. Clique "Deploy". Au bout de 1-2 min tu obtiens une URL du style `https://bxrp-site.vercel.app`.

---

## Étape 4 — Connecter les deux

1. Retourne sur Render → ton service backend → Environment.
2. Mets à jour `CORS_ORIGINS` avec l'URL Vercel obtenue : `https://bxrp-site.vercel.app` (sans slash final). Tu peux mettre plusieurs domaines séparés par des virgules si besoin.
3. Sauvegarde → Render redéploie automatiquement.
4. Va sur ton site Vercel et teste l'inscription/connexion pour vérifier que le frontend parle bien au backend.

---

## Nom de domaine personnalisé (optionnel)

- Achète un domaine (Namecheap, OVH, Google Domains...).
- Dans Vercel : Project → Settings → Domains → ajoute ton domaine, suis les instructions DNS.
- Pense à rajouter ce nouveau domaine dans `CORS_ORIGINS` sur Render.

---

## Activer Stripe plus tard

Quand tu seras prêt :
1. Crée un compte https://stripe.com, récupère ta clé secrète (`sk_live_...` ou `sk_test_...` pour tester).
2. Sur Render, ajoute la variable d'environnement `STRIPE_API_KEY`.
3. Dans `backend/requirements.txt`, décommente la ligne `emergentintegrations==0.2.0` (ou installe la version publique disponible : `pip install emergentintegrations` — vérifie la dernière version sur https://pypi.org/project/emergentintegrations/).
4. Redéploie sur Render.

---

## Récap des fichiers ajoutés pour le déploiement
- `backend/.env.example` — variables d'environnement backend à dupliquer en `.env` pour tester en local
- `frontend/.env.example` — idem côté frontend
- `render.yaml` — config automatique pour Render
- `frontend/vercel.json` — config pour le routage React sur Vercel
- `backend/server.py` — import Stripe rendu optionnel pour ne pas bloquer le démarrage si le paquet n'est pas installé
