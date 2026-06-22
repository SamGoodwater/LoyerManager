# Jeu de démonstration

Fichiers **100 % fictifs** pour tester Loyer Manager sans données personnelles.

| Fichier | Usage |
|---------|--------|
| [`loyer-data.demo.json`](loyer-data.demo.json) | Jeu complet : bailleur, locataire, loyers, virements déjà enregistrés |
| [`releve-bancaire.demo.csv`](releve-bancaire.demo.csv) | Relevé bancaire type export français (import CSV) |

## Personnages fictifs

- **Bailleur** : SCI Les Tilleuls (Paris 15e)
- **Locataire** : Mme Claire Martin (Boulogne-Billancourt)
- **Loyer** : 650 € jusqu'au 31/12/2024, puis 680 €
- **E-mail** : `claire.martin@example.com` (domaine réservé aux exemples)

## Charger le jeu de démo (JSON)

```bash
cp docs/demo/loyer-data.demo.json data/loyer-data.json
chmod 664 data/loyer-data.json   # adapter selon l'utilisateur PHP (www-data)
```

Puis rechargez l'application dans le navigateur.

## Tester l'import CSV

1. Chargez d'abord le JSON de démo (ci-dessus).
2. Onglet **Virements** → **Importer CSV** → choisissez `releve-bancaire.demo.csv`.
3. L'application doit reconnaître les virements de **Mme Claire Martin** et ignorer le salaire / remboursement.
4. Les lignes déjà présentes dans le JSON (même réf. bancaire ou date+montant) apparaissent comme **doublons**.

## Motifs bancaires configurés

Dans Paramètres → Émetteurs, les libellés suivants sont recherchés :

- `CLAIRE MARTIN`
- `MME CLAIRE MARTIN`
- `VIR LOYER MARTIN`
