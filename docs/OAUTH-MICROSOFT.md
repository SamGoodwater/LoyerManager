# Microsoft Entra ID — OAuth identité et envoi Outlook

Guide à jour (2025–2026) pour configurer **la connexion à Loyer Manager** (`login.html`) et **l'envoi de mails via Outlook** (Paramètres → Envoi mail), avec le portail **Microsoft Entra admin center** (ex-Azure AD).

Références officielles :
- [Enregistrer une application](https://learn.microsoft.com/fr-fr/entra/identity-platform/quickstart-register-app)
- [URI de redirection](https://learn.microsoft.com/fr-fr/entra/identity-platform/reply-url)
- [Graph `sendMail`](https://learn.microsoft.com/fr-fr/graph/api/user-sendmail)

---

## Ce qui a changé chez Microsoft

| Avant | Maintenant |
|-------|------------|
| Portail « Azure Active Directory » | **Microsoft Entra admin center** — [entra.microsoft.com](https://entra.microsoft.com) |
| « Azure AD App registrations » | **Identité → Applications → Inscriptions d'applications** |
| Azure AD | **Microsoft Entra ID** (même protocole OAuth 2.0 / OpenID Connect) |
| Multitenant « + comptes Microsoft personnels » | Toujours requis pour `@outlook.com` / `@hotmail.com` ; règles **plus strictes** sur les URI de redirection |

Loyer Manager utilise :
- le endpoint **`/common`** (`tenant => 'common'` dans `config.php`) ;
- le flux **authorization code** avec **refresh token** (`offline_access`) ;
- des permissions **déléguées** (pas « Application ») — obligatoire pour les boîtes Outlook personnelles.

---

## Deux usages, une seule application Entra

| Usage | Où dans l'app | Scopes |
|-------|---------------|--------|
| **Connexion identité** | `login.html` → Continuer avec Microsoft | `openid`, `profile`, `email`, `User.Read`, `offline_access` |
| **Envoi / brouillon mail** | Paramètres → Envoi mail → Outlook | `Mail.Send`, `Mail.ReadWrite`, `openid`, `profile`, `email`, `offline_access` |

Les deux flux partagent **le même `client_id` / `client_secret`** et la **même URL de redirection** (voir ci-dessous).

---

## Prérequis

1. **HTTPS en production** (OAuth Microsoft refuse en pratique les sites non sécurisés).
2. **`encryption_key`** dans `config.php` (tokens chiffrés dans `data/loyer.db`).
3. Un **tenant Entra actif** pour enregistrer l'application.

### Obtenir un tenant (si le portail bloque l'inscription)

Erreur fréquente : **`AADSTS5000225`** — tenant par défaut d'un compte Microsoft inactif.

Solutions :

| Option | Pour qui |
|--------|----------|
| [Microsoft 365 Developer Program](https://developer.microsoft.com/microsoft-365/dev-program) | Sandbox M365 (éligibilité variable depuis 2024) |
| Compte Azure gratuit | [portal.azure.com](https://portal.azure.com) → créer un annuaire Entra |
| Nouveau compte `@outlook.com` | Obtient un tenant « Default Directory » non bloqué |

Vous n'avez **pas** besoin d'inviter votre compte Outlook personnel dans le tenant pour envoyer du mail : l'app multitenant + comptes personnels suffit.

---

## Étape 1 — Inscrire l'application

1. Ouvrez [entra.microsoft.com](https://entra.microsoft.com) avec un compte **administrateur du tenant** (celui où vous créez l'app).
2. **Identité** → **Applications** → **Inscriptions d'applications** → **Nouvelle inscription**.
3. Renseignez :
   - **Nom** : `Loyer Manager` (ou votre domaine).
   - **Types de comptes pris en charge** — choisissez selon votre cas :

| Type de compte cible | Option à cocher |
|----------------------|-----------------|
| Outlook **personnel** (`@outlook.com`, `@hotmail.com`, `@live.fr`…) **et/ou** pro | **Comptes dans un annuaire d'organisation (n'importe quel locataire Entra ID – Multilocataire) et comptes Microsoft personnels** |
| Uniquement Microsoft 365 **pro / école** (pas de comptes perso) | **Comptes dans un annuaire d'organisation (Multilocataire)** |
| Un seul tenant (entreprise) | **Comptes dans cet annuaire uniquement** → `'tenant' => 'VOTRE-TENANT-ID'` dans `config.php` |

4. **URI de redirection** : laissez vide pour l'instant → **Inscrire**.

5. Notez sur la page **Vue d'ensemble** :
   - **ID d'application (client)** → `client_id`
   - **ID de l'annuaire (locataire)** → utile si single-tenant

---

## Étape 2 — URI de redirection (critique)

Dans l'app → **Authentication** (Authentification) → **Add a platform** → **Web**.

Ajoutez **exactement** (adapter le domaine) :

**Production :**
```
https://VOTRE-DOMAINE/oauth/callback/microsoft.php
```

**Développement local :**
```
http://127.0.0.1:8080/oauth/callback/microsoft.php
```

> Microsoft **interdit** les paramètres de requête (`?action=…`) dans l'URI enregistrée pour les comptes personnels. Loyer Manager utilise donc ce fichier dédié (sans query string). Google conserve l'ancienne URI `api.php?action=oauth-callback&provider=google`.

---

## Étape 3 — Secret client

1. **Certificates & secrets** → **New client secret**.
2. Description + durée (24 mois max.) → **Add**.
3. Copiez la **Value** immédiatement (visible une seule fois) → `client_secret` dans `config.php`.

Microsoft limite à **2 secrets actifs** pour les apps ouvertes aux comptes personnels.

---

## Étape 4 — Permissions Microsoft Graph (déléguées)

**API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions** :

| Permission | Usage Loyer Manager |
|------------|---------------------|
| `openid` | Connexion OAuth (souvent implicite) |
| `profile` | Nom affiché |
| `email` | Adresse e-mail |
| `User.Read` | Profil à la connexion identité |
| `Mail.Send` | Envoi des quittances |
| `Mail.ReadWrite` | **Brouillons** dans Outlook |
| `offline_access` | Refresh token (reconnexion automatique) |

**Ne pas** ajouter `Mail.Send` en **Application** pour un usage `@outlook.com` personnel — ce flux ne fonctionne pas (pas de boîte Exchange Online, pas de client credentials).

### Consentement administrateur

| Contexte | Action |
|----------|--------|
| App perso + votre compte `@outlook.com` | Consentement **utilisateur** au premier login (pas d'admin) |
| Tenant entreprise | **Grant admin consent** si politique stricte |

---

## Étape 5 — `config.php`

```php
'encryption_key' => 'VOTRE_CLE_BASE64_32_OCTETS',

'oauth' => [
    'microsoft' => [
        'enabled' => true,
        'client_id' => 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        'client_secret' => 'votre-secret',
        // common = comptes perso + tous les tenants pro
        // consumers = comptes Microsoft personnels uniquement
        // VOTRE-TENANT-ID = single-tenant entreprise
        'tenant' => 'common',
    ],
],
```

Générer `encryption_key` :
```bash
php -r "echo base64_encode(random_bytes(32)), PHP_EOL;"
```

---

## Étape 6 — Tester

### Connexion identité
1. Ouvrez `login.html` (ou première visite → création de compte).
2. **Continuer avec Microsoft**.
3. Acceptez les permissions.
4. Redirection vers `index.html`.

### Envoi mail Outlook
1. **Paramètres** → **Destinataires** : renseignez au moins une adresse.
2. **Paramètres** → **Envoi mail** → **Connecter Outlook**.
3. Onglet **Mail** → test **Brouillon** puis **Envoyer**.

Si le bouton Brouillon reste grisé : déconnectez puis reconnectez Outlook (scopes `Mail.ReadWrite`).

---

## Comptes `@outlook.com` vs Microsoft 365 pro

| | Outlook personnel | M365 / école |
|---|-------------------|--------------|
| Permission | **Déléguée** uniquement | **Déléguée** (recommandé) |
| Endpoint | `tenant => 'common'` | `common` ou tenant fixe |
| Licence Exchange | Non requise | Non requise pour Graph delegated |
| Brouillon | Oui (OAuth) | Oui |
| Admin consent | Non (perso) | Parfois oui |

---

## URI exacte à enregistrer (vérification)

L'URI envoyée à Microsoft est calculée par le serveur. Pour éviter tout écart :

1. Ouvrez dans le navigateur :  
   `https://VOTRE-DOMAINE/api.php?action=auth-status`
2. Repérez **`oauthRedirectUris.microsoft`** dans le JSON.
3. Copiez cette valeur **à l'identique** dans Entra → Authentication → Web.

Si la valeur est incorrecte (mauvais domaine, sous-dossier manquant), ajoutez dans `config.php` :

```php
'public_base_url' => 'https://danki.loyermanager.iota21.fr',
```

Puis revérifiez `auth-status`.

---

## Dépannage

| Erreur / symptôme | Cause probable | Action |
|-------------------|----------------|--------|
| `AADSTS50011` | URI de redirection ≠ Entra | Voir **URI exacte** ci-dessous ; copier-coller dans Authentication → Web |
| `AADSTS5000225` | Tenant inactif | Developer Program ou nouveau tenant |
| `AADSTS50020` | Compte perso sur app single-tenant | Repasser l'app en multilocataire + comptes perso |
| `AADSTS90023` | Comptes perso non supportés | Vérifier **Types de comptes** à l'inscription |
| « can't sign in with a personal account here » | Mauvais endpoint / type de comptes | `tenant => 'common'` + audience `AzureADandPersonalMicrosoftAccount` |
| Pas de refresh token | `offline_access` manquant ou consent partiel | Reconnecter ; vérifier permissions |
| `MailboxNotEnabledForRESTAPI` | Tentative client credentials / compte sans Graph mail | Utiliser flux **délégué** ; pas Application permission |
| Envoi OK, brouillon KO | `Mail.ReadWrite` absent | Ajouter permission + reconnecter |
| Token expiré | Refresh échoué | Déconnecter / reconnecter dans Paramètres |
| `encryption_key manquante` | Config | Renseigner `config.php` |

Vérifier le manifeste (option avancée) : **`signInAudience`** = `AzureADandPersonalMicrosoftAccount` pour perso + pro.

---

## Checklist rapide

- [ ] App enregistrée sur [entra.microsoft.com](https://entra.microsoft.com)
- [ ] Type de comptes adapté (perso + pro si `@outlook.com`)
- [ ] Plateforme **Web** + URI de redirection exacte
- [ ] Secret client copié dans `config.php`
- [ ] Permissions Graph **déléguées** : `Mail.Send`, `Mail.ReadWrite`, `User.Read`, `offline_access`
- [ ] `encryption_key` définie
- [ ] HTTPS en production
- [ ] Test login Microsoft + test envoi / brouillon mail

---

## Voir aussi

- [OAUTH-MAIL.md](OAUTH-MAIL.md) — vue d'ensemble Gmail / Outlook / SMTP
- [SECURITE.md](SECURITE.md) — couches HTTPS, session, chiffrement
