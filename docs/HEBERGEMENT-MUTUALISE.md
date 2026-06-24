# Hébergement mutualisé (sans terminal)

Guide pour installer Loyer Manager sur un hébergement web classique (Apache, PHP, panneau type cPanel / Plesk / DirectAdmin). **Aucune commande shell** requise.

---

## Prérequis côté hébergeur

- PHP **7.4+** (8.x recommandé), extensions OpenSSL, cURL, JSON et **SQLite**
- Apache avec **mod_rewrite** (standard)
- Dossier **`vendor/`** inclus dans l'archive (pas de Composer sur le serveur)
- Espace FTP ou **Gestionnaire de fichiers**
- Certificat **SSL** (Let's Encrypt ou équivalent)

---

## 1. Envoyer les fichiers

### Option A — Gestionnaire de fichiers

1. Téléchargez ou clonez le projet sur votre ordinateur.
2. Compressez le dossier en `.zip` (sans `data/loyer-data.json`, `data/loyer.db` ni `config.php` personnels).
3. Uploadez et **extrayez** dans le dossier cible (`public_html/`, sous-domaine dédié, etc.).

### Option B — Client FTP

Uploadez tout le contenu : `js/`, `css/`, `lib/`, `php/`, `index.html`, `login.html`, `api.php`, etc.

---

## 2. Configuration

1. Copiez `config.example.php` en **`config.php`**.
2. Renseignez au minimum :
   - **`encryption_key`** — **obligatoire** si OAuth mail ou SMTP (voir [`OAUTH-MAIL.md`](OAUTH-MAIL.md))
   - **`api_key`** optionnelle après création du compte (voir [`SECURITE.md`](SECURITE.md))
   - Identifiants OAuth identité (Google/Microsoft) et OAuth mail si envoi Gmail/Outlook

---

## 3. Droits d'écriture

PHP doit pouvoir créer et modifier :

| Dossier | Permission courante |
|---------|---------------------|
| `data/` | **755** ou **775** |
| `templates/` | **755** ou **775** |

Au premier accès, l'application crée `loyer-data.json` et `loyer.db` dans `data/`.

---

## 4. Protéger l'accès (recommandé)

1. Panneau → **Confidentialité / Protection du répertoire**.
2. Sélectionnez le dossier de Loyer Manager.
3. Créez un utilisateur et un mot de passe.

Complétez avec la **connexion Loyer Manager** (`login.html`) — voir [`SECURITE.md`](SECURITE.md).

---

## 5. HTTPS

Activez le SSL pour votre domaine. Testez : `https://votre-adresse/` → cadenas vert.

---

## 6. Premier lancement

1. Ouvrez `https://votre-adresse/` (mot de passe site si configuré).
2. Vous êtes redirigé vers **`login.html`** → créez votre compte (e-mail + passphrase, Google ou Microsoft).
3. Renseignez **Paramètres** : bailleur, locataire, loyer, émetteurs CSV.
4. Optionnel : **Paramètres → Envoi mail** pour Gmail/Outlook ou SMTP ; **Mon compte** pour changer la passphrase (compte local).

Les paramètres sont **sauvegardés automatiquement** ; le bouton **Enregistrer** en bas à droite force une sauvegarde immédiate.

### Jeu de démonstration

Uploadez `docs/demo/loyer-data.demo.json` vers `data/loyer-data.json`, puis rechargez la page. Voir [`demo/README.md`](demo/README.md).

---

## 7. Vérifications

| Test | Résultat attendu |
|------|------------------|
| `https://…/api.php?action=status` | JSON `"ok": true` |
| `https://…/data/loyer-data.json` | **403** ou **404** |
| Connexion + export profil | Téléchargement JSON |

---

## 7. Vérifications post-installation

- [ ] `https://votre-adresse/` redirige vers `login.html` si non connecté
- [ ] Création de compte (passphrase) ou connexion Google/Microsoft OK
- [ ] Paramètres enregistrés (message ou bouton Enregistrer)
- [ ] `https://votre-adresse/data/loyer-data.json` → **403** ou **404**
- [ ] Export profil JSON (Paramètres → Mon compte)
- [ ] Sauvegarde FTP de `data/loyer.db`, `data/loyer-data.json`, `templates/`, `config.php`
- [ ] Test envoi mail ou brouillon si OAuth configuré

---

## Sauvegarde (mutualisé)

1. Export profil JSON depuis l'application.
2. Téléchargez via FTP : `data/loyer.db`, `data/loyer-data.json`, dossier `templates/`, `config.php`.
3. Lors d'une mise à jour : remplacez les fichiers applicatifs **sans écraser** `data/` ni `config.php`.

---

## Dépannage courant

**Redirection vers login en boucle**  
→ Vérifiez que PHP peut écrire dans `data/` (sessions et SQLite).

**Erreur d'écriture**  
→ Droits sur `data/` et `templates/`.

**Page blanche ou 403 partout**  
→ Conflit de `.htaccess` — utilisez un **sous-domaine dédié**.

**Envoi mail impossible**  
→ `encryption_key`, OAuth ou SMTP — voir [`OAUTH-MAIL.md`](OAUTH-MAIL.md).

---

## Différence avec un VPS (Debian)

| | Mutualisé | VPS / Debian |
|---|-----------|--------------|
| Installation | FTP / panneau | [`deploy/scripts/install-apache.sh`](../deploy/scripts/install-apache.sh) |
| Mot de passe site | Panneau hébergeur | Apache Basic Auth |
| Mise à jour | Remplacer les fichiers | `git pull` |

Même application, même [`SECURITE.md`](SECURITE.md).
