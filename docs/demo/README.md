# Jeu de démonstration

Fichiers **100 % fictifs** pour tester Loyer Manager sans données personnelles.

| Fichier | Usage |
|---------|--------|
| [`loyer-data.demo.json`](loyer-data.demo.json) | État initial après reset (virements, paliers loyer/charges) |
| [`releve-bancaire.demo.csv`](releve-bancaire.demo.csv) | Relevé bancaire pour tester l'import CSV |

## Personnages fictifs

- **Bailleur** : SCI Les Tilleuls (Paris 15e)
- **Locataire** : Mme Claire Martin (Boulogne-Billancourt)
- **Loyer** : 580 € + 70 € charges (2024) → 600 € + 80 € charges (2025+)
- **E-mail** : `claire.martin@example.com`

## Couverture temporelle

Historique **janvier 2024 → février 2026** dans le JSON (24 virements).

**Sans virement dans le JSON** (mois impayés avant import CSV) :

- **Septembre 2024** et **septembre 2025**

## Scénarios visibles dans l'app (état initial)

| Scénario | Période | Détail |
|----------|---------|--------|
| **Palier loyer + charges** | Paramètres → Historique | 650 €/mois (2024) puis 680 €/mois (2025+) |
| **Payé à jour** | La plupart des mois | Virement le 4 ou 5 du mois |
| **Saisie manuelle** | Mars 2024 | Statut « manuel », sans libellé bancaire |
| **Trop-perçu (avance)** | Mai 2024 | 660 € reçus (+10 €) |
| **Retard** | Juillet 2024, janv. 2026 | Reçu après le 5 du mois |
| **Sous-paiement** | Août 2024, août 2025 | −50 € puis −80 € |
| **Mois impayé** | Sept. 2024, sept. 2025 | Aucun virement — combler via CSV |
| **Paiement en 2 fois** | Oct. 2025 | JSON : acompte 340 € — CSV : solde 340 € |
| **Virement vérifié** | Mai 2025 | Statut « vérifié » |
| **Surplus** | Fév. 2026 | 730 € reçus (+50 €) |
| **Solde cumulé** | Tableau de bord | Dette partielle août 2025 non soldée avant fév. |

## Scénarios via import CSV

| Scénario | Effet attendu |
|----------|----------------|
| **Combler impayés** | Sept. 2024 (650 €) et sept. 2025 (680 €) importés |
| **Solde octobre 2025** | 2e virement 340 € → mois complet |
| **Nouveau mois** | Mars et avril 2026 (680 €) |
| **Doublons ignorés** | Lignes en double (même réf. bancaire que le JSON) |
| **Doublon avril 2026** | 2 lignes identiques → une seule importée |
| **Bruit bancaire** | Salaire, assurance, remboursement frais — ignorés |

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
2. **Virements** → **Importer CSV** → `releve-bancaire.demo.csv`.
3. Vérifiez sept. 2024/2025, solde oct. 2025, mars–avr. 2026, doublons et bruit ignorés.

## Motifs bancaires (Paramètres → Émetteurs)

- `CLAIRE MARTIN`
- `MME CLAIRE MARTIN`
- `VIR LOYER MARTIN`
- `LOYER MARTIN`
