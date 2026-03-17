# MostaSetup Studio

Editeur visuel pour generer des fichiers `setup.json` utilises par `@mostajs/setup`.

## Demarrage rapide

```bash
npm install
npm run dev
# Ouvrir http://localhost:4600
```

## Fonctionnalites

### Onglet App
- Nom de l'application, port HTTP, prefix de base de donnees
- Variables d'environnement personnalisees (ajoutees a `.env.local` lors de l'installation)

### Onglet RBAC
Quatre sous-onglets pour definir le controle d'acces :

**Categories** — Groupes de permissions (ex: Administration, Clients, Tickets)
- Nom unique, label affiche, description, icone Lucide, ordre d'affichage

**Permissions** — Droits individuels (ex: `client:view`, `ticket:create`)
- Code unique au format `module:action`, description, categorie parente
- Groupees visuellement par categorie

**Roles** — Profils utilisateurs (ex: admin, agent_accueil, superviseur)
- Attribution des permissions par role
- Option `*` pour accorder toutes les permissions

**Matrice** — Vue globale roles x permissions
- Tableau interactif : roles en colonnes, permissions groupees par categorie en lignes
- Cocher/decocher par cellule, par categorie entiere, ou tout pour un role
- Indicateurs visuels : categorie partiellement cochee, wildcard `*`

### Onglet Seeds
Donnees optionnelles proposees comme checkboxes dans le wizard d'installation :
- Chaque seed cible une collection (ex: `activity`, `user`)
- **match** : champ pour l'upsert idempotent (ex: `slug`, `email`)
- **hashField** : champ a hasher avec bcrypt (ex: `password`)
- **roleField** : champ contenant un nom de role, resolu en ID a l'execution
- **defaults** : valeurs fusionnees dans chaque ligne
- Editeur tabulaire avec ajout/suppression de colonnes et lignes

### Onglet Preview
- Apercu JSON en temps reel
- Avertissements de validation (references croisees categories/permissions/roles)

### Onglet Export
- Telecharger `setup.json`
- Copier le JSON dans le presse-papiers
- Instructions d'integration dans un projet Next.js

## Import / Reset
- **Importer** : charger un `setup.json` existant pour le modifier
- **Reset** : reinitialiser l'editeur (confirmation requise)
- Persistance automatique dans `localStorage`

## Exemple de setup.json genere

```json
{
  "$schema": "https://mostajs.dev/schemas/setup.v1.json",
  "app": {
    "name": "SecuAccessPro",
    "port": 4567,
    "dbNamePrefix": "secuaccessdb"
  },
  "env": {
    "MOSTAJS_MODULES": "orm,auth,audit,rbac,settings,setup"
  },
  "rbac": {
    "categories": [
      { "name": "admin", "label": "Administration", "icon": "Settings", "order": 0 },
      { "name": "client", "label": "Clients", "icon": "Users", "order": 1 }
    ],
    "permissions": [
      { "code": "admin:access", "description": "Acceder au panneau", "category": "admin" },
      { "code": "client:view", "description": "Voir les clients", "category": "client" },
      { "code": "client:create", "description": "Creer un client", "category": "client" }
    ],
    "roles": [
      { "name": "admin", "description": "Administrateur complet", "permissions": ["*"] },
      { "name": "agent", "description": "Agent standard", "permissions": ["client:view", "client:create"] }
    ]
  },
  "seeds": [
    {
      "key": "activities",
      "label": "Activites",
      "collection": "activity",
      "match": "slug",
      "default": true,
      "data": [
        { "name": "Piscine", "slug": "piscine", "price": 800 },
        { "name": "Tennis", "slug": "tennis", "price": 1000 }
      ]
    },
    {
      "key": "demoUsers",
      "label": "Utilisateurs demo",
      "collection": "user",
      "match": "email",
      "hashField": "password",
      "roleField": "role",
      "defaults": { "status": "active" },
      "data": [
        { "email": "agent@app.dz", "password": "Agent@123", "firstName": "Karim", "role": "agent" }
      ]
    }
  ]
}
```

## Integration dans un projet

```typescript
// src/app/api/setup/install/route.ts
import { loadSetupJson, runInstall } from '@mostajs/setup'
import type { InstallConfig } from '@mostajs/setup'

export async function POST(req: Request) {
  const body: InstallConfig = await req.json()
  const config = await loadSetupJson('./setup.json', myRepoFactory)
  const result = await runInstall(body, config)
  return Response.json(result)
}
```

## CLI alternatif

Pour generer un `setup.json` sans interface graphique :

```bash
# Mode interactif (terminal)
npx mosta-setup

# Mode rapide (CI/scripts)
npx mosta-setup --quick --name MonApp --port 4567 --db monappdb --modules "orm,auth,setup"

# Sortie stdout (pipe)
npx mosta-setup --quick --name MonApp --stdout > setup.json
```

## Stack technique

- Next.js 16 (static export)
- Tailwind CSS 4
- Lucide React (icones)
- Zero backend, zero dependance externe

## Auteur

Dr Hamid MADANI drmdh@msn.com
