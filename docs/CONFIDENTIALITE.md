# Politique de confidentialité — Loyer Manager

Loyer Manager est une application **auto-hébergée** : le responsable du traitement est la personne qui installe et exploite l'instance (bailleur, gestionnaire).

## Données collectées

| Donnée | Support | Finalité |
|--------|---------|----------|
| Informations bailleur, locataire, loyer, virements | `data/loyer-data.json` | Gestion des loyers |
| Modèles quittance/mail | `templates/` | Génération de documents |
| Compte utilisateur (e-mail, passphrase hashée) | `data/loyer.db` | Authentification |
| Journal d'activité (mails, brouillons, CSV, exports) | `data/loyer.db` | Traçabilité |
| Tokens OAuth mail (Gmail/Outlook) | `data/loyer.db` (chiffrés) | Envoi et brouillons |
| Configuration SMTP (mot de passe chiffré) | `data/loyer.db` | Envoi sans OAuth |

**Aucune publicité, aucun analytics tiers.**

## Cookies et stockage local

| Mécanisme | Usage |
|-----------|--------|
| Cookie **LOYER_SESS** | Session de connexion à l'application |
| Cookie **LOYER_OAUTH** | Flux OAuth temporaire (connexion ou mail) |
| **sessionStorage** | Clé API legacy (si utilisée) |
| **localStorage** | Consentement au bandeau RGPD |

## Durée de conservation

- Données métier : jusqu'à suppression par l'utilisateur (export/import profil JSON).
- Historique : **24 mois** par défaut (onglet **Historique** ; 0 = illimité).
- Tokens OAuth mail : jusqu'à déconnexion dans Paramètres → Envoi mail.

## Vos droits

Sur votre instance :

- Exporter le profil (Paramètres → Mon compte)
- Changer la passphrase (compte local — Paramètres → Mon compte)
- Exporter ou purger l'historique (onglet **Historique**)
- Déconnecter OAuth mail
- Supprimer vos données ou votre compte (Paramètres → Mon compte)

## Sécurité

- HTTPS recommandé en production
- Mot de passe site + passphrase / OAuth (voir [`SECURITE.md`](SECURITE.md))
- `encryption_key` dans `config.php` pour chiffrer tokens OAuth et SMTP

## Contact

Pour une instance personnelle, vous êtes à la fois utilisateur et responsable du traitement. Pour une instance tierce, contactez son administrateur.
