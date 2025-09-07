from flask import Flask, request, jsonify, render_template
from typing import Dict, Any, List, Set, Optional
from pathlib import Path
import json
from collections import deque

app = Flask(__name__)

# -----------------------------
# Chargement des données JSON
# -----------------------------
def load_genealogy_data(file_path: str) -> Dict[str, Dict[str, Any]]:
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            raw_data = json.load(file)

            personnes = []
            if isinstance(raw_data, dict) and "personnes" in raw_data:
                personnes = raw_data["personnes"]
            elif isinstance(raw_data, list):
                personnes = raw_data
            elif isinstance(raw_data, dict):
                return raw_data
            else:
                return {}

            # Vérifier l'unicité des noms
            names = [p["name"] for p in personnes if "name" in p]
            duplicates = set(name for name in names if names.count(name) > 1)
            if duplicates:
                raise ValueError(f"Noms en double détectés : {duplicates}")

            return {p["name"]: p for p in personnes if "name" in p}

    except FileNotFoundError:
        print("⚠️ Fichier non trouvé, données vides utilisées.")
        return {}
    except json.JSONDecodeError:
        print("⚠️ Erreur de décodage JSON.")
        return {}
    except ValueError as ve:
        print(f"❌ {ve}")
        return {}


# Chemin vers le fichier JSON
DATA_FILE_PATH = Path(__file__).parent / "genealogy_data.json"
personnes_et_relations = load_genealogy_data(DATA_FILE_PATH)


# -----------------------------
# Gestionnaire de données
# -----------------------------
class FamilyDataManager:
    """Gestion des données généalogiques"""
    def __init__(self, data: Dict[str, Dict[str, Any]]):
        self.data = data
        self._process_data()

    def _process_data(self):
        """Crée relations bidirectionnelles : parents/enfants ET conjoints"""
        for name, info in self.data.items():
            # Synchroniser enfants ↔ parents
            for enfant in info.get("enfants", []):
                if enfant in self.data:
                    self.data[enfant].setdefault("parents", [])
                    if name not in self.data[enfant]["parents"]:
                        self.data[enfant]["parents"].append(name)

            for parent in info.get("parents", []):
                if parent in self.data:
                    self.data[parent].setdefault("enfants", [])
                    if name not in self.data[parent]["enfants"]:
                        self.data[parent]["enfants"].append(name)

            # Synchroniser conjoints (bidirectionnel)
            for conjoint in info.get("conjoints", []):
                if conjoint in self.data:
                    self.data[conjoint].setdefault("conjoints", [])
                    if name not in self.data[conjoint]["conjoints"]:
                        self.data[conjoint]["conjoints"].append(name)

    # -----------------------------
    # Accès et recherche
    # -----------------------------
    def get_all_people(self) -> List[Dict[str, str]]:
        return [
            {
                "id": name,
                "name": name,
                "gender": info.get("genre", "Inconnu")
            }
            for name, info in self.data.items()
        ]

    def search_people(self, query: str) -> List[Dict[str, str]]:
        query_lower = query.lower()
        results = [
            {
                "id": name,
                "name": name,
                "gender": info.get("genre", "Inconnu")
            }
            for name, info in self.data.items()
            if query_lower in name.lower()
        ]
        # Trier par pertinence
        results.sort(key=lambda x: x["name"].lower().find(query_lower))
        return results[:10]

    def get_person_details(self, name: str) -> Optional[Dict[str, Any]]:
        if name not in self.data:
            return None
        info = self.data[name]

        parents_details = [
            {"name": p, "gender": self.data[p].get("genre", "Inconnu")}
            for p in info.get("parents", []) if p in self.data
        ]
        children_details = [
            {"name": c, "gender": self.data[c].get("genre", "Inconnu")}
            for c in info.get("enfants", []) if c in self.data
        ]
        spouses_details = [
            {"name": s, "gender": self.data[s].get("genre", "Inconnu")}
            for s in info.get("conjoints", []) if s in self.data
        ]

        return {
            "id": name,
            "name": name,
            "gender": info.get("genre", "Inconnu"),
            "parents": info.get("parents", []),
            "children": info.get("enfants", []),
            "spouses": info.get("conjoints", []),
            "parents_details": parents_details,
            "children_details": children_details,
            "spouses_details": spouses_details
        }

    # -----------------------------
    # Arbres et sous-ensembles
    # -----------------------------
    def _get_related_people(self, start_person: str, direction: str, max_depth: int = 5) -> Set[str]:
        """BFS pour récupérer ancêtres ou descendants"""
        if start_person not in self.data:
            return set()

        visited = set()
        to_visit = deque([(start_person, 0)])

        while to_visit:
            current_person, depth = to_visit.popleft()
            if current_person in visited or depth > max_depth:
                continue
            visited.add(current_person)

            relatives = []
            if direction == "ancestors":
                relatives = self.data[current_person].get("parents", [])
            elif direction == "descendants":
                relatives = self.data[current_person].get("enfants", [])

            for relative in relatives:
                if relative not in visited:
                    to_visit.append((relative, depth + 1))

        return visited

    def _get_family_subset(self, name: str, direction: str) -> Dict[str, Any]:
        if name not in self.data:
            return {"nodes": [], "links": []}

        related_people = self._get_related_people(name, direction)
        nodes = [
            {
                "id": person_name,
                "name": person_name,
                "gender": self.data[person_name].get("genre", "Inconnu")
            }
            for person_name in related_people
            if person_name in self.data
        ]

        links = []

        # Liens parent → enfant
        for person_name in related_people:
            if person_name not in self.data:
                continue
            for enfant in self.data[person_name].get("enfants", []):
                if enfant in related_people:
                    links.append({
                        "source": person_name,
                        "target": enfant,
                        "type": "parent"
                    })

        # Liens conjoints (A → B seulement si A < B pour éviter doublons)
        for person_name in related_people:
            if person_name not in self.data:
                continue
            for conjoint in self.data[person_name].get("conjoints", []):
                if conjoint in related_people and person_name < conjoint:
                    links.append({
                        "source": person_name,
                        "target": conjoint,
                        "type": "spouse"
                    })

        return {"nodes": nodes, "links": links}

    def get_ancestors(self, name: str) -> Dict[str, Any]:
        return self._get_family_subset(name, "ancestors")

    def get_descendants(self, name: str) -> Dict[str, Any]:
        return self._get_family_subset(name, "descendants")

    def get_hierarchical_tree(self) -> Dict[str, Any]:
        """Construit un arbre hiérarchique à partir des racines"""
        def find_roots():
            return [name for name, info in self.data.items() if not info.get("parents")]

        def build_hierarchy(person_name: str, visited: Set[str]) -> Optional[Dict[str, Any]]:
            if person_name in visited or person_name not in self.data:
                return None
            visited.add(person_name)
            info = self.data[person_name]
            node = {
                "id": person_name,
                "name": person_name,
                "gender": info.get("genre", "Inconnu"),
                "children": []
            }
            for child in info.get("enfants", []):
                child_node = build_hierarchy(child, visited)
                if child_node:
                    node["children"].append(child_node)
            visited.remove(person_name)
            return node

        hierarchy = []
        visited = set()
        roots = find_roots()[:5]

        for root in roots:
            root_node = build_hierarchy(root, visited)
            if root_node:
                hierarchy.append(root_node)

        return {"hierarchy": hierarchy}

    def get_full_tree(self) -> Dict[str, Any]:
        """Retourne tous les nœuds et liens"""
        nodes = self.get_all_people()
        links = []

        # Liens parent → enfant
        for name, info in self.data.items():
            for enfant in info.get("enfants", []):
                if enfant in self.data:
                    links.append({
                        "source": name,
                        "target": enfant,
                        "type": "parent"
                    })

        # Liens conjoints
        for name, info in self.data.items():
            for conjoint in info.get("conjoints", []):
                if conjoint in self.data and name < conjoint:
                    links.append({
                        "source": name,
                        "target": conjoint,
                        "type": "spouse"
                    })

        return {"nodes": nodes, "links": links}

    # -----------------------------
    # Algorithme pour trouver le chemin entre deux personnes — CORRIGÉ
    # -----------------------------
    def find_shortest_path(self, start_name: str, end_name: str) -> Optional[Dict[str, Any]]:
        """
        Trouve le chemin le plus court entre deux personnes via BFS.
        Retourne un sous-graphe (nodes + links) représentant le chemin.
        """
        if start_name not in self.data or end_name not in self.data:
            return None

        # BFS
        queue = deque([(start_name, [start_name])])
        visited = set()

        while queue:
            current, path = queue.popleft()
            if current in visited:
                continue
            visited.add(current)

            if current == end_name:
                # Construire le sous-graphe
                nodes = [
                    {
                        "name": name,
                        "id": name,
                        "gender": self.data[name].get("genre", "Inconnu")
                    }
                    for name in path
                ]

                links = []
                # Parcourir chaque paire consécutive
                for i in range(len(path) - 1):
                    a = path[i]
                    b = path[i + 1]

                    a_data = self.data[a]
                    b_data = self.data[b]

                    # Vérifier type de lien
                    if b in a_data.get("enfants", []):
                        links.append({"source": a, "target": b, "type": "parent"})
                    elif a in b_data.get("enfants", []):
                        links.append({"source": b, "target": a, "type": "parent"})
                    elif b in a_data.get("conjoints", []):
                        links.append({"source": a, "target": b, "type": "spouse"})
                    elif a in b_data.get("conjoints", []):
                        links.append({"source": b, "target": a, "type": "spouse"})

                return {"nodes": nodes, "links": links}

            # Ajouter voisins
            current_data = self.data[current]
            neighbors = set(
                current_data.get("parents", []) +
                current_data.get("enfants", []) +
                current_data.get("conjoints", [])
            )

            for neighbor in neighbors:
                if neighbor not in visited and neighbor in self.data:
                    queue.append((neighbor, path + [neighbor]))

        return None  # Pas de chemin trouvé


# -----------------------------
# Initialisation
# -----------------------------
family_manager = FamilyDataManager(personnes_et_relations)


# -----------------------------
# Routes Flask
# -----------------------------
@app.route("/")
def index():
    return render_template('index.html')

@app.route("/api/tree")
def api_tree():
    return jsonify(family_manager.get_full_tree())

@app.route("/api/person/<name>")
def api_person(name):
    person = family_manager.get_person_details(name)
    if person:
        return jsonify(person)
    else:
        return jsonify({"error": "Personne non trouvée"}), 404

@app.route("/api/ancestors/<name>")
def api_ancestors(name):
    return jsonify(family_manager.get_ancestors(name))

@app.route("/api/descendants/<name>")
def api_descendants(name):
    return jsonify(family_manager.get_descendants(name))

@app.route("/api/people")
def api_people():
    return jsonify(family_manager.get_all_people())

@app.route("/api/hierarchical-tree")
def api_hierarchical_tree():
    return jsonify(family_manager.get_hierarchical_tree())

@app.route("/api/search")
def api_search():
    query = request.args.get("q", "")
    return jsonify(family_manager.search_people(query))

# -----------------------------
# Route : relation entre deux personnes — CORRIGÉE
# -----------------------------
@app.route("/api/relation-path")
def api_relation_path():
    person1 = request.args.get("person1")
    person2 = request.args.get("person2")

    if not person1 or not person2:
        return jsonify({"error": "Deux noms sont requis"}), 400

    path_data = family_manager.find_shortest_path(person1, person2)

    if path_data is None:
        return jsonify({"error": "Aucun chemin trouvé entre ces deux personnes"}), 404

    return jsonify(path_data)

# -----------------------------
# Endpoint de validation (optionnel)
# -----------------------------
@app.route("/api/validate")
def api_validate():
    """Valide l'intégrité des données"""
    errors = []

    for name, info in family_manager.data.items():
        for parent in info.get("parents", []):
            if parent not in family_manager.data:
                errors.append(f"{name} référence un parent inconnu : {parent}")
        for enfant in info.get("enfants", []):
            if enfant not in family_manager.data:
                errors.append(f"{name} référence un enfant inconnu : {enfant}")
        for conjoint in info.get("conjoints", []):
            if conjoint not in family_manager.data:
                errors.append(f"{name} référence un conjoint inconnu : {conjoint}")

    if errors:
        return jsonify({"valid": False, "errors": errors}), 400
    else:
        return jsonify({"valid": True, "message": "✅ Toutes les références sont valides."})

# -----------------------------
# Lancement
# -----------------------------
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)