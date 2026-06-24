# Envoi mail (Gmail, Outlook et SMTP)

Envoi direct depuis l'application : OAuth 2.0 (Gmail / Outlook) ou serveur SMTP classique.

## Prérequis serveur

- PHP 7.4+ avec extensions OpenSSL, JSON, cURL et **SQLite** (historique + tokens)
- Dossier `data/` accessible en écriture (`loyer.db`, `loyer-data.json`)
- `vendor/` présent (dépendances PHP incluses dans le dépôt)
- **`encryption_key`** renseignée dans `config.php` (chiffrement des tokens OAuth et du mot de passe SMTP)
- HTTPS en production (obligatoire pour OAuth)

## Configuration `config.php`

1. Copiez `config.example.php` → `config.php`
2. Générez une clé de chiffrement :

```bash
php -r "echo base64_encode(random_bytes(32)), PHP_EOL;"
```

3. Renseignez :

```php
'encryption_key' => 'VOTRE_CLE_BASE64',
'oauth' => [
    'google' => [
        'enabled' => true,
        'client_id' => '...apps.googleusercontent.com',
        'client_secret' => '...',
    ],
    'microsoft' => [
        'enabled' => true,
        'client_id' => '...',
        'client_secret' => '...',
        'tenant' => 'common',
    ],
],
```

**Microsoft (Entra ID)** : procédure détaillée pas à pas → **[OAUTH-MICROSOFT.md](OAUTH-MICROSOFT.md)** (portail Entra, permissions Graph, comptes `@outlook.com`, dépannage).

## URLs de redirection OAuth mail

À enregistrer **exactement** dans la console Google / Azure :

```
https://VOTRE-DOMAINE/api.php?action=oauth-callback&provider=google
https://VOTRE-DOMAINE/oauth/callback/microsoft.php
```

En local :

```
http://127.0.0.1:8080/api.php?action=oauth-callback&provider=google
```

## Scopes OAuth (envoi mail)

| Fournisseur | Scopes utilisés |
|-------------|-----------------|
| Google | `gmail.send`, `gmail.compose`, `email` |
| Microsoft | `Mail.Send`, `Mail.ReadWrite`, `offline_access`, profil |

Le scope **compose / ReadWrite** permet d'enregistrer un **brouillon** dans la boîte mail. Si Gmail était connecté avant une mise à jour, **déconnectez puis reconnectez** le compte dans Paramètres.

## Connexion identité vs connexion mail

- **Connexion à Loyer Manager** (`login.html`) : compte local ou Google/Microsoft (scopes identité) — session `LOYER_SESS`.
- **Envoi mail** (Paramètres → Envoi mail) : OAuth Gmail/Outlook **distinct** — tokens stockés chiffrés dans `loyer.db`.

Les deux peuvent utiliser les mêmes identifiants d'application OAuth dans `config.php`, avec des URLs de redirection différentes selon le flux.

## Utilisation dans l'application

1. **Paramètres → Destinataires** : adresses À, CC, CCI
2. **Paramètres → Envoi mail (Gmail / Outlook)** : connecter le compte expéditeur  
   **ou Paramètres → SMTP** : alternative sans OAuth (envoi direct uniquement)
3. Onglet **Mail** :
   - **Brouillon** — mail + PDF dans Gmail/Outlook (OAuth requis)
   - **Envoyer** — envoi immédiat (OAuth ou SMTP)
   - **Autres** — EML + PDF (fichier local) ou mailto (sans pièce jointe auto)

## SMTP (sans OAuth)

Paramètres → **Envoi mail (SMTP)** : serveur, port, identifiants, adresse expéditeur. Le mot de passe est chiffré avec `encryption_key`.  
**Limitation :** pas de brouillon dans la boîte mail — utilisez **EML + PDF** dans ce cas. Si OAuth mail est connecté, il est **prioritaire** sur le SMTP.

## Dépannage

| Problème | Piste |
|----------|--------|
| `encryption_key manquante` | Renseignez la clé dans `config.php` |
| Redirect URI mismatch | URL exacte dans Google Cloud / Azure |
| Token expiré | Déconnectez et reconnectez le compte mail |
| Bouton Brouillon grisé | OAuth mail requis ; reconnectez si besoin |
| Envoi refusé | Vérifiez destinataires, OAuth/SMTP, onglet **Historique** pour le détail |
| PDF trop volumineux | Réduisez la période ; vérifiez `post_max_size` PHP |

## Historique

Les envois et brouillons sont journalisés dans l'onglet **Historique** (filtre « Brouillons mail » ou « Mails envoyés »).
