# Hébergement mutualisé (sans terminal)

Guide **générique** pour installer Loyer Manager sur un hébergement web classique (Apache, PHP, panneau type cPanel / Plesk / DirectAdmin). **Aucune commande shell** n'est requise.

Convient à la plupart des hébergeurs français et internationaux.

---

## Prérequis côté hébergeur

- PHP **7.4+** (8.x recommandé)
- Apache avec **mod_rewrite** (standard)
- Espace FTP ou **Gestionnaire de fichiers** dans le panneau
- Certificat **SSL** (Let's Encrypt ou équivalent)

---

## 1. Envoyer les fichiers

### Option A — Gestionnaire de fichiers (panneau)

1. Téléchargez ou clonez le projet sur votre ordinateur.
2. Compressez le dossier en `.zip` (sans `data/loyer-data.json` ni `config.php` personnels).
3. Dans le panneau, ouvrez le **Gestionnaire de fichiers**.
4. Allez dans le dossier cible :
   - sous-domaine dédié → souvent `public_html/` ou `loyer.votredomaine.fr/`
   - sous-dossier → `public_html/loyer/` par exemple
5. Uploadez et **extrayez** l'archive.

### Option B — Client FTP (FileZilla, etc.)

Même arborescence : uploadez tout le contenu du projet (dossiers `js/`, `css/`, `lib/`, `index.html`, `api.php`, etc.).

### Fichiers à ne pas publier par inadvertance

- Vos sauvegardes personnelles `loyer-data.json` si elles contiennent des données réelles que vous ne voulez pas écraser — uploadez-les **volontairement** dans `data/` seulement si vous migrez un site existant.

---

## 2. Configuration PHP

1. Copiez `config.example.php` en **`config.php`** (même dossier que `index.html`).
2. Éditez `config.php` dans le gestionnaire de fichiers.
3. En production, renseignez une **`api_key`** (voir [SECURITE.md](SECURITE.md)).

---

## 3. Droits d'écriture

PHP doit pouvoir créer et modifier :

- `data/` (fichier `loyer-data.json`)
- `templates/quittances/` et `templates/mails/` (modèles)

Dans le gestionnaire de fichiers, permissions courantes :

| Dossier | Permission |
|---------|------------|
| `data/` | **755** ou **775** |
| `templates/` | **755** ou **775** |

Si l'app affiche une erreur d'écriture, passez temporairement à **775** ou contactez le support de l'hébergeur.

Au premier accès, l'application crée les fichiers manquants via `api.php`.

---

## 4. Protéger l'accès (recommandé)

Ne laissez pas l'URL publique sans protection.

1. Panneau → outil **Confidentialité / Protection du répertoire** (nom variable selon l'hébergeur).
2. Sélectionnez le dossier de Loyer Manager.
3. Activez la protection par mot de passe.
4. Créez un utilisateur et un mot de passe.

Détails et couche API : [SECURITE.md](SECURITE.md).

---

## 5. HTTPS

Activez le SSL pour votre domaine ou sous-domaine (Let's Encrypt, AutoSSL, etc.) dans le panneau.

Testez : `https://votre-adresse/` → le cadenas du navigateur doit être vert.

---

## 6. Premier lancement

1. Ouvrez `https://votre-adresse/` (saisissez le mot de passe du site si configuré).
2. Le badge doit indiquer **Enregistré** (vert) si `api.php` répond.
3. Si une clé API est définie : **Paramètres → Données** → collez la clé → **Connecter**.
4. Renseignez bailleur, locataire, loyer dans **Paramètres**.

### Jeu de démonstration (test)

Uploadez le contenu de `docs/demo/loyer-data.demo.json` vers `data/loyer-data.json` via le gestionnaire de fichiers, puis rechargez la page.

---

## 7. Vérifications

| Test | Résultat attendu |
|------|------------------|
| `https://…/api.php?action=status` | JSON `"ok": true` |
| `https://…/data/loyer-data.json` | **403** ou **404** (accès direct bloqué) |
| Export JSON dans Paramètres | Téléchargement d'une copie de secours |

---

## Dépannage courant

**Badge « Serveur indisponible »**  
→ Ouvrez le site en `https://`, pas en `file://`. Vérifiez que `api.php` est bien uploadé.

**Erreur 500 sur les modèles**  
→ Droits d'écriture sur `templates/` (étape 3).

**Page blanche ou 403 partout**  
→ Conflit de `.htaccess` avec un autre site (WordPress…) dans le même dossier. Utilisez un **sous-domaine dédié**.

**Clé API refusée**  
→ La valeur dans `config.php` doit être **identique** à celle saisie dans Paramètres.

---

## Différence avec un VPS (Debian)

| | Mutualisé | VPS / Debian |
|---|-----------|--------------|
| Installation | FTP / panneau | Scripts `deploy/debian/` |
| Mot de passe site | Panneau hébergeur | nginx `auth_basic` ou Apache |
| Mise à jour | Remplacer les fichiers par FTP | `git pull` + scripts |

Les deux environnements utilisent la même application et la même [politique de sécurité](SECURITE.md).
