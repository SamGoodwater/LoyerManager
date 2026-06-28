# Jeu de démonstration

Fichiers **100 % fictifs** pour tester Loyer Manager sans données personnelles.

| Fichier | Usage |
|---------|--------|
| [`demo/loyer-data.demo.json`](../../demo/loyer-data.demo.json) | État initial après reset (virements, paliers loyer/charges) — **déployé en prod** |
| [`demo/releve-bancaire.demo.csv`](../../demo/releve-bancaire.demo.csv) | Relevé bancaire pour tester l'import CSV |

## Personnages fictifs

- **Bailleur** : SCI Les Tilleuls (Paris 15e)
- **Locataire** : Mme Claire Martin (Boulogne-Billancourt)
- **Loyer** : 580 € + 70 € charges (2024) → 600 € + 80 € charges (2025+)
- **E-mail** : `claire.martin@example.com`
- **Signature** : image PNG embarquée dans le JSON (aperçu quittance)

## Couverture temporelle

Historique **janvier 2024 → juin 2026** dans le JSON golden (**30 virements**).

Le fichier inclut déjà les scénarios habituellement obtenus via import CSV (sept. 2024/2025, solde oct. 2025, mars–avr. 2026).

## Scénarios visibles dans l'app (état initial)

| Scénario | Période | Détail |
|----------|---------|--------|
| **Palier loyer + charges** | Paramètres → Historique | 650 €/mois (2024) puis 680 €/mois (2025+) |
| **Payé à jour** | La plupart des mois | Virement le 4 ou 5 du mois |
| **Saisie manuelle** | Mars 2024, juin 2026 | Statut « manuel », sans libellé bancaire |
| **Trop-perçu (avance)** | Mai 2024 | 660 € reçus (+10 €) |
| **Retard** | Juillet 2024, janv. 2026 | Reçu après le 5 du mois |
| **Sous-paiement** | Août 2024, août 2025 | −50 € puis −80 € |
| **Paiement en 2 fois** | Oct. 2025 | Acompte + solde (680 € au total) |
| **Virement vérifié** | Mai 2025 | Statut « vérifié » |
| **Surplus** | Fév. 2026 | 730 € reçus (+50 €) |
| **Solde cumulé** | Tableau de bord | Dette partielle août 2025 non soldée avant fév. |
| **Signature bailleur** | Quittance | Image de signature dans Paramètres |

## Scénarios via import CSV

| Scénario | Effet attendu |
|----------|----------------|
| **Doublons ignorés** | Lignes déjà présentes dans le golden (avr. et mars 2026, janv. 2026, sept. 2024…) |
| **Doublon mars 2026** | 2 lignes identiques dans le CSV → une seule importée |
| **Bruit bancaire** | Salaire, assurance, remboursement frais — ignorés |
| **Nouveaux mois** | **13 virements** absents du golden (mai 2026 → mai 2027, dont oct. 2026 en 2 fois) |

## Téléchargement en mode démo

Sur l'onglet **Virements**, un encart propose de **télécharger** `releve-bancaire.demo.csv` (visible uniquement en mode démonstration). Importez ensuite le fichier via **Importer CSV** ou glisser-déposer.

## Mode démo en ligne (`demo_mode`)

Sur une instance **dédiée** (`demo.example.com`), utilisez le script d'initiation :

```bash
cd /chemin/LoyerManager
sudo LOYER_USER=www-data ./scripts/demo-init.sh \
  --url https://demo.loyermanager.iota21.fr \
  --cron-hours 6 \
  --yes
```

Reset manuel : `php scripts/demo-reset.php` (nécessite `demo_mode` dans `config.php`).

## Tester l'import CSV

1. Ouvrez l'app (mode démo).
2. **Virements** → **Télécharger le relevé bancaire de démo (CSV)** puis **Importer CSV** (ou glisser-déposer).
3. Vérifiez les **~13 nouveaux virements** proposés, les **doublons ignorés** et le **bruit bancaire**.

## Actualiser le golden depuis `data/`

Après enrichissement local de `data/loyer-data.json` :

```bash
cp data/loyer-data.json demo/loyer-data.demo.json
# ou sous PowerShell : copier puis formater si besoin
```

Puis committer `demo/loyer-data.demo.json` et uploader sur le serveur démo. Supprimez `data/.demo-last-reset` sur le serveur (ou attendez le reset automatique) pour forcer la restauration.

## Motifs bancaires (Paramètres → Émetteurs)

- `CLAIRE MARTIN`
- `MME CLAIRE MARTIN`
- `VIR LOYER MARTIN`
- `LOYER MARTIN`
