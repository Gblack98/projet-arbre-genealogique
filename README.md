# Arbre Généalogique - Famille Diop

## Description
Application web interactive pour explorer l'arbre généalogique de la famille Diop. Les données sont maintenant stockées localement dans le code Python, éliminant le besoin d'une base de données externe.

## Fonctionnalités

### 🌳 Visualisation Interactive
- **Arbre complet** : Affichage de toute la généalogie
- **Navigation par ancêtres/descendants** : Exploration ciblée
- **Zoom et pan** : Navigation fluide dans l'arbre
- **Interface responsive** : Adaptation mobile et desktop

### 🔍 Recherche Avancée
- **Recherche en temps réel** : Suggestions automatiques
- **Sélection rapide** : Clic pour centrer sur une personne
- **Mise en surbrillance** : Identification visuelle des personnes

### 📋 Informations Détaillées
- **Panneau d'information** : Détails complets de chaque personne
- **Relations familiales** : Parents, enfants, conjoints
- **Genre et statut** : Informations personnelles

## Structure des Fichiers

```
projet/
├── app.py              # Application Flask principale
├── index.html          # Interface utilisateur (optionnel)
├── requirements.txt    # Dépendances Python
└── README.md          # Ce fichier
```

## Installation et Démarrage

### Prérequis
- Python 3.7+
- pip

### Installation
```bash
# Cloner ou télécharger les fichiers
# Installer les dépendances
pip install -r requirements.txt
```

### Démarrage
```bash
python app.py
```

L'application sera accessible à l'adresse : `http://127.0.0.1:5000`

## Architecture Technique

### Backend (Flask)
- **FamilyDataManager** : Gestionnaire des données généalogiques
- **API REST** : Endpoints pour les données familiales
- **Stockage local** : Données intégrées dans le code Python

### Frontend (JavaScript/D3.js)
- **D3.js** : Visualisation de graphique de force
- **CSS moderne** : Design glassmorphisme et animations
- **JavaScript ES6+** : Interface interactive

## API Endpoints

### Personnes
- `GET /api/people` - Liste toutes les personnes
- `GET /api/person/<nom>` - Détails d'une personne
- `GET /api/search?q=<requête>` - Recherche de personnes

### Relations
- `GET /api/ancestors/<nom>` - Ancêtres d'une personne
- `GET /api/descendants/<nom>` - Descendants d'une personne
- `GET /api/tree` - Arbre généalogique complet

## Données

Les données généalogiques sont structurées comme suit :

```python
{
    "Nom Complet": {
        "genre": "Homme/Femme",
        "parents": ["Parent1", "Parent2"],
        "enfants": ["Enfant1", "Enfant2"],
        "conjoints": ["Conjoint1", "Conjoint2"]
    }
}
```

### Traitement Automatique
- **Relations bidirectionnelles** : Génération automatique des liens parent-enfant
- **Validation des données** : Vérification de la cohérence
- **Optimisation des requêtes** : Recherche efficace

## Utilisation

### Interface Web
1. **Chargement** : L'arbre complet s'affiche au démarrage
2. **Recherche** : Tapez un nom pour rechercher une personne
3. **Navigation** :
   - Clic sur une personne → Affichage des détails
   - "Ancêtres" → Affiche uniquement les ancêtres
   - "Descendants" → Affiche uniquement les descendants
   - "Tout Afficher" → Retour à l'arbre complet
4. **Zoom** : Utilisez les contrôles ou la molette de la souris

### Contrôles
- **Glisser-déposer** : Réorganiser les nœuds
- **Zoom** : Boutons + / - ou molette
- **Ajustement automatique** : Bouton ⌂ pour ajuster à l'écran

## Personnalisation

### Ajouter des Personnes
Modifiez le dictionnaire `personnes_et_relations` dans `app.py` :

```python
"Nouvelle Personne": {
    "genre": "Homme",  # ou "Femme"
    "parents": ["Parent1", "Parent2"],  # optionnel
    "enfants": ["Enfant1"],             # optionnel
    "conjoints": ["Conjoint1"]          # optionnel
}
```

### Modifier le Style
Les styles CSS sont dans `index.html` ou peuvent être externalisés.

### Étendre l'API
Ajoutez de nouvelles routes dans `app.py` selon vos besoins.

## Migration depuis Neo4j

Cette version remplace complètement Neo4j par :
- **Stockage local** : Données dans le code Python
- **Gestionnaire de données** : Classe `FamilyDataManager`
- **Pas de dépendances externes** : Seulement Flask requis
- **Performance améliorée** : Pas de latence réseau

## Avantages de cette Approche

### ✅ Simplicité
- Aucune base de données à configurer
- Déploiement simplifié
- Maintenance réduite

### ✅ Performance
- Accès instantané aux données
- Pas de latence réseau
- Recherche optimisée en mémoire

### ✅ Portabilité
- Code autocontenu
- Facile à déplacer et sauvegarder
- Pas de dépendances externes complexes

## Support et Contribution

Pour toute question ou amélioration :
1. Vérifiez que Flask est bien installé
2. Assurez-vous que le port 5000 est libre
3. Consultez les logs de la console pour les erreurs

Les contributions sont les bienvenues !
