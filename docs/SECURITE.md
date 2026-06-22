# Sécurité — guide général

Loyer Manager est conçu pour **un ou quelques utilisateurs** (bailleur, conjoint…), **sans comptes** et **sans base de données**. La protection repose sur **trois couches** complémentaires, utilisables sur tout hébergeur (mutualisé, VPS, serveur perso).

## La clé API, c'est quoi ?

La **`api_key`** dans `config.php` n'est **pas** un login ni un compte. C'est un **secret partagé** entre l'application (navigateur) et le fichier `api.php` sur le serveur.

| | Mot de passe du **site** | **Clé API** |
|---|---------------------------|-------------|
| **Où** | Panneau hébergeur ou nginx/Apache | `config.php` + Paramètres → Données |
| **Effet** | Bloque l'accès à **toutes les pages** (HTML, JS…) | Bloque **lecture/écriture des données** via `api.php` |
| **Affichage** | Fenêtre identifiant/mot de passe du navigateur | Champ dans Paramètres (une fois par session) |
| **Obligatoire** | Recommandé si URL publique | Recommandé si URL publique (en plus du mot de passe site) |

**Pourquoi les deux ?** Le mot de passe site empêche de voir l'interface. La clé API empêche quelqu'un d'appeler directement `api.php?action=data` pour lire ou modifier `loyer-data.json` sans connaître le secret — même si l'interface était accessible.

En **local** (`localhost`), vous pouvez laisser `api_key` **vide** : l'app fonctionne sans la demander.

## Les trois couches (recommandé en production)

| Couche | Rôle | Sans terminal ? |
|--------|------|-----------------|
| **1. HTTPS** | Chiffre les échanges (obligatoire si mot de passe web) | Oui — certificat Let's Encrypt dans le panneau d'hébergement |
| **2. Mot de passe devant le site** | Empêche d'ouvrir l'interface sans identifiant | Oui — « protection de répertoire » (cPanel, Plesk, etc.) |
| **3. Clé API** (`config.php`) | Protège lecture/écriture via `api.php` | Oui — éditeur de fichiers ou FTP |

Aucune couche ne remplace les autres sur une URL publique : combinez **HTTPS + mot de passe site + clé API**.

---

## Couche 1 — HTTPS

Activez un certificat SSL sur votre hébergeur (Let's Encrypt, AutoSSL, etc.).

Sans HTTPS, un mot de passe « devant le site » (HTTP Basic Auth) circule en clair sur le réseau.

---

## Couche 2 — Mot de passe devant tout le site

Mécanisme standard du web : **HTTP Basic Auth**. Un identifiant et un mot de passe sont demandés par le navigateur avant d'afficher une page.

### Hébergement mutualisé (Apache + panneau)

La plupart des hébergeurs proposent un outil du type :

- **Confidentialité du répertoire** (cPanel)
- **Protection des répertoires** (Plesk, DirectAdmin, etc.)

Étapes générales :

1. Ouvrez le panneau de contrôle de votre hébergeur.
2. Choisissez le dossier où sont installés les fichiers de Loyer Manager.
3. Activez la protection par mot de passe et créez un utilisateur.
4. Le panneau génère automatiquement les fichiers `.htaccess` et `.htpasswd`.

Aucune commande shell n'est nécessaire.

### VPS / serveur Debian (nginx)

Voir [`deploy/debian/README`](../deploy/debian/README) et l'exemple [`deploy/nginx/basic-auth.example.conf`](../deploy/nginx/basic-auth.example.conf).

### VPS / serveur Apache (manuel)

Voir [`deploy/apache/basic-auth.example`](../deploy/apache/basic-auth.example).

### Bonnes pratiques

- Préférez un **sous-domaine dédié** (`loyer.example.com`) plutôt qu'un sous-dossier d'un CMS (WordPress, etc.) pour éviter les conflits de `.htaccess`.
- Un mot de passe **partagé** suffit (usage familial).
- Ne réutilisez pas le mot de passe de votre boîte mail.

---

## Couche 3 — Clé API (`config.php`)

1. Copiez `config.example.php` en `config.php`.
2. Définissez une clé longue et aléatoire :

```php
return [
    'api_key' => 'collez-ici-une-longue-chaine-aleatoire',
];
```

3. Dans l'application : **Paramètres → Données** → saisissez la même clé → **Connecter**.

La clé est stockée dans le navigateur (`sessionStorage`) le temps de la session.

**Effet :** même si quelqu'un atteint `api.php`, les actions `data` et `template` renvoient **401** sans la clé. Les endpoints `status` et `config` restent publics (ils n'exposent pas vos données).

Vous pouvez utiliser la **même valeur** que le mot de passe du site, ou **deux secrets différents**.

---

## Fichiers sensibles (accès HTTP direct)

Le dépôt inclut des règles pour **interdire** l'accès direct aux dossiers `data/` et `templates/` :

- **Apache** : règles dans le `.htaccess` à la racine (+ fichiers dans `data/` et `templates/`).
- **nginx** : voir [`deploy/debian/nginx/loyer-manager.conf`](../deploy/debian/nginx/loyer-manager.conf).

Les données ne doivent transiter que via **`api.php`**, jamais en ouvrant `data/loyer-data.json` dans le navigateur.

---

## Ce qui n'est pas prévu (volontairement)

| Approche | Pourquoi |
|----------|----------|
| Comptes utilisateurs | Complexité, base de données, hors scope |
| Connexion par e-mail (lien magique) | SMTP, tokens, maintenance — inutile pour 1–3 personnes |
| OAuth / Google | Idem |

---

## Checklist rapide (URL publique)

- [ ] HTTPS activé
- [ ] Mot de passe devant le répertoire de l'application
- [ ] `config.php` avec `api_key` renseignée
- [ ] Clé saisie une fois dans Paramètres → Données
- [ ] Copie de secours régulière (export JSON dans l'app)
- [ ] `data/` et `templates/` non lisibles directement (test : ouvrir `https://votre-site/data/loyer-data.json` → doit être refusé)

---

## Voir aussi

- [Hébergement mutualisé sans terminal](HEBERGEMENT-MUTUALISE.md)
- [Déploiement Debian / nginx](../deploy/debian/README)
