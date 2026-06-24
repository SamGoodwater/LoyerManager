# Sécurité — guide général

Loyer Manager est conçu pour **un bailleur par instance** (usage personnel ou familial). La protection repose sur **HTTPS**, **authentification par session** et, en complément, un mot de passe hébergeur et/ou une clé API legacy.

## Authentification (session PHP)

Dès qu'un compte existe, l'accès à `api.php` (données, modèles, mail…) exige une **session PHP** (`LOYER_SESS`) :

| Mode | Usage |
|------|--------|
| **E-mail + passphrase** | Créé au premier lancement sur `login.html` — minimum 8 caractères, phrase longue recommandée (sans règles de complexité imposées) |
| **Google / Microsoft (OAuth identité)** | Connexion via `login.html` — scopes `openid`, `email`, `profile` |
| **Clé API legacy** | Encore acceptée tant qu'**aucun compte utilisateur** n'est enregistré (migration douce) |

Le compte utilisateur (passphrase hashée) et le mot de passe SMTP chiffré sont stockés dans **`data/loyer.db`**. Les loyers et virements restent dans **`data/loyer-data.json`**.

### Mon compte (compte local)

- **Changer la passphrase** : Paramètres → Mon compte (compte local uniquement ; les comptes Google/Microsoft n'utilisent pas de passphrase applicative).
- **Export profil** : sauvegarde JSON chiffrée (mot de passe de sauvegarde choisi à l'export) — loyers + paramètres serveur.
- **Import à l'initiation** : sur `login.html`, sans compte existant, vous pouvez valider une sauvegarde v2 puis créer un compte (local ou OAuth) ; les données sont restaurées automatiquement.
- **Suppression compte** : efface le compte, OAuth mail et SMTP ; les loyers dans `loyer-data.json` restent sur le serveur.

Durée de session : `auth.session_lifetime_hours` (défaut 720 h = 30 jours). Cookie « rester connecté » HttpOnly `LOYER_REMEMBER` : `auth.remember_lifetime_days` (défaut 180 jours). Révoqué à la déconnexion ou changement de passphrase.

---

## Données sensibles sur le serveur

| Fichier | Contenu |
|---------|---------|
| `data/loyer-data.json` | Loyers, virements, paramètres métier |
| `data/loyer.db` | Compte utilisateur, historique, tokens OAuth mail (chiffrés), SMTP chiffré |
| `config.php` | `encryption_key`, secrets OAuth, clé API |

Les tokens OAuth mail et le mot de passe SMTP sont chiffrés avec **`encryption_key`** dans `config.php`. **Obligatoire** dès que OAuth mail ou SMTP est utilisé.

---

## La clé API (`api_key`)

Secret partagé entre le navigateur et `api.php`. Ce n'est **pas** la passphrase de connexion à l'application.

| | Mot de passe du **site** (hébergeur) | **Session Loyer Manager** | **Clé API** |
|---|--------------------------------------|---------------------------|-------------|
| **Où** | Panneau hébergeur / Apache Basic Auth | `login.html` | `config.php` (legacy) |
| **Effet** | Bloque l'accès aux **pages** | Protège `api.php` une fois un compte créé | Protège `api.php` sans compte utilisateur |
| **Obligatoire** | Recommandé si URL publique | Oui (compte créé au 1er lancement) | Optionnel après migration |

La section **Paramètres → Données** (clé API) n'apparaît qu'en cas de besoin (migration ou erreur de connexion).

---

## Couches recommandées (URL publique)

| Couche | Rôle |
|--------|------|
| **1. HTTPS** | Chiffre les échanges — obligatoire si mot de passe web |
| **2. Mot de passe devant le site** | HTTP Basic Auth via le panneau hébergeur (optionnel mais recommandé) |
| **3. Compte Loyer Manager** | Session PHP après `login.html` |
| **4. Clé API** | Uniquement si aucun compte n'a encore été créé |

---

## Couche 1 — HTTPS

Activez un certificat SSL sur votre hébergeur (Let's Encrypt, AutoSSL, etc.). Sans HTTPS, un mot de passe HTTP Basic Auth circule en clair.

---

## Couche 2 — Mot de passe devant tout le site

### Hébergement mutualisé

Outil **Confidentialité / Protection du répertoire** (cPanel, Plesk, DirectAdmin…) sur le dossier de l'application.

### VPS / Debian (Apache)

[`deploy/scripts/install-apache.sh`](../deploy/scripts/install-apache.sh) · [`deploy/apache/basic-auth.example`](../deploy/apache/basic-auth.example)

Préférez un **sous-domaine dédié** (`loyer.example.com`) plutôt qu'un sous-dossier d'un CMS.

---

## Fichiers sensibles (accès HTTP direct)

Le dépôt interdit l'accès direct à `data/`, `templates/` et `config.php` via `.htaccess` (Apache) ou la config du VirtualHost.

Les données ne doivent transiter que via **`api.php`**.

Test : `https://votre-site/data/loyer-data.json` → **403** ou **404**.

Sur **nginx** ou **IIS**, reproduisez ces règles manuellement (le `.htaccess` ne s'applique pas).

---

## Sauvegarde et restauration

| Secret | Rôle |
|--------|------|
| **Mot de passe de sauvegarde** | Chiffre / déchiffre le fichier export v2 (PBKDF2 + AES-256-GCM). Indépendant de la passphrase compte et de OAuth. |
| **Passphrase compte local** | Accès à l'application uniquement. |
| **`encryption_key` (`config.php`)** | Déchiffre tokens OAuth mail et SMTP **en base** ; un import de `loyer.db` ne restaure ces secrets que si la même clé est présente sur le serveur cible. |
| **OAuth Google / Microsoft (identité)** | Prouve qui vous êtes à l'initiation ; ne remplace pas le mot de passe de sauvegarde ni l'identité du compte exporté. |

| Élément | Méthode |
|---------|---------|
| Loyers et paramètres | Export profil v2 chiffré (Paramètres → Mon compte) |
| Compte, historique, OAuth mail, SMTP | Inclus dans l'export v2 (partie SQLite chiffrée dans le JSON) |
| Modèles personnalisés | Inclus dans `loyerData` ; modèles de base recréés au besoin |
| Secrets serveur | Copie sécurisée de `config.php` (hors dépôt Git) |

**Restauration à l'initiation** : sans compte existant, `login.html` propose « Préparer la restauration » (fichier v2 + mot de passe de sauvegarde). Après validation (session 15 min), créez votre compte — local ou Google/Microsoft — : les données sont importées automatiquement. Seules les sauvegardes v2 chiffrées sont acceptées à cette étape (pas les exports v1 en clair).

**Fréquence recommandée** : avant chaque mise à jour de l'application et après import CSV massif.

**Restauration manuelle** : import depuis Mon compte (connecté) ou remplacement des fichiers sur le serveur (en conservant les droits d'écriture sur `data/`). Ne mélangez pas un `loyer.db` d'une autre instance avec un `loyer-data.json` incompatible.

---

## Prérequis PHP (production)

- Extensions : JSON, **PDO SQLite**, OpenSSL, cURL
- Si l'extension SQLite est absente, l'application affiche un message générique — contactez votre hébergeur (pas de commande `apt` côté utilisateur mutualisé)
- Pour les pièces jointes PDF : vérifier `post_max_size` et `upload_max_filesize` (≥ 8 Mo recommandé)

---

## Ce qui reste hors scope

| Approche | Pourquoi |
|----------|----------|
| Multi-utilisateurs / rôles | Instance mono-bailleur |
| Lien magique par e-mail | Complexité SMTP inutile pour 1–3 personnes |
| Synchronisation cloud | Données auto-hébergées par design |

---

## Checklist rapide (URL publique)

- [ ] HTTPS activé
- [ ] Mot de passe devant le répertoire (recommandé)
- [ ] Compte créé sur `login.html` ; passphrase longue et mémorable
- [ ] `config.php` avec `encryption_key` si OAuth mail ou SMTP
- [ ] Sauvegarde régulière (`loyer.db` + export profil JSON + `templates/`)
- [ ] `data/` et `config.php` non lisibles directement depuis le navigateur (403/404)
- [ ] Test connexion + changement passphrase (compte local)

---

## Voir aussi

- [Hébergement mutualisé](HEBERGEMENT-MUTUALISE.md)
- [Envoi mail OAuth et SMTP](OAUTH-MAIL.md)
- [Déploiement Apache](../deploy/README.md)
