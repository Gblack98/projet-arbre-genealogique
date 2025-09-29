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

            # Vérifier unicité des noms
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
    def __init__(self, data: Dict[str, Dict[str, Any]]):
        self.data = data
        self._process_data()

    def _process_data(self):
        """Crée relations bidirectionnelles : parents/enfants ET conjoints"""
        for name, info in self.data.items():
            # Parents ↔ enfants
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

            # Conjoints ↔ bidirectionnels
            for conjoint in info.get("conjoints", []):
                if conjoint in self.data:
                    self.data[conjoint].setdefault("conjoints", [])
                    if name not in self.data[conjoint]["conjoints"]:
                        self.data[conjoint]["conjoints"].append(name)

    # -----------------------------
    # Hiérarchie : chaque enfant rattaché à TOUS ses parents
    # -----------------------------
    def build_clean_hierarchy_server(self) -> List[Dict[str, Any]]:
        def build_person_node(person_name: str, visited: Set[str] = None) -> Optional[Dict[str, Any]]:
            if visited is None:
                visited = set()
            if person_name in visited:
                return None
            if person_name not in self.data:
                return None

            person = self.data[person_name]
            new_path = visited | {person_name}

            node = {
                "id": person_name,
                "name": person_name,
                "genre": person.get("genre", "Inconnu"),
                "children": []
            }

            # Ajouter tous les enfants (sans empêcher plusieurs rattachements)
            for child_name in person.get("enfants", []):
                if child_name in self.data:
                    child_node = build_person_node(child_name, new_path)
                    if child_node:
                        node["children"].append(child_node)

            return node

        # Racines = personnes sans parents
        roots = [name for name, info in self.data.items() if not info.get("parents", [])]

        hierarchy = []
        for root in roots:
            root_node = build_person_node(root)
            if root_node:
                hierarchy.append(root_node)

        return hierarchy

    def get_hierarchical_tree_clean(self) -> Dict[str, Any]:
        return {
            "hierarchy": self.build_clean_hierarchy_server(),
            "personnes": [
                {
                    "name": name,
                    "genre": info.get("genre", "Inconnu"),
                    "parents": info.get("parents", []),
                    "enfants": info.get("enfants", []),
                    "conjoints": info.get("conjoints", [])
                }
                for name, info in self.data.items()
            ]
        }

    # -----------------------------
    # Hiérarchie limitée en profondeur
    # -----------------------------
    def get_hierarchical_tree_limited(self, max_depth: int = 10) -> Dict[str, Any]:
        def build_limited(person_name: str, depth: int = 0, visited: Set[str] = None) -> Optional[Dict[str, Any]]:
            if visited is None:
                visited = set()
            if person_name in visited or person_name not in self.data or depth >= max_depth:
                return None

            visited.add(person_name)
            person = self.data[person_name]
            node = {
                "id": person_name,
                "name": person_name,
                "genre": person.get("genre", "Inconnu"),
                "children": [],
                "depth": depth,
                "has_more_children": False
            }

            for child in person.get("enfants", []):
                if depth < max_depth - 1:
                    child_node = build_limited(child, depth + 1, visited.copy())
                    if child_node:
                        node["children"].append(child_node)
                else:
                    node["has_more_children"] = True
            return node

        roots = [n for n, info in self.data.items() if not info.get("parents", [])][:3]
        hierarchy = [build_limited(r) for r in roots if r]

        return {"hierarchy": hierarchy, "max_depth": max_depth, "total_roots": len(roots)}

    # -----------------------------
    # Accès et recherche
    # -----------------------------
    def get_all_people(self) -> List[Dict[str, str]]:
        return [{"id": n, "name": n, "gender": i.get("genre", "Inconnu")} for n, i in self.data.items()]

    def search_people(self, query: str) -> List[Dict[str, str]]:
        q = query.lower()
        results = [{"id": n, "name": n, "gender": i.get("genre", "Inconnu")} for n, i in self.data.items() if q in n.lower()]
        results.sort(key=lambda x: x["name"].lower().find(q))
        return results[:10]

    def get_person_details(self, name: str) -> Optional[Dict[str, Any]]:
        if name not in self.data:
            return None
        info = self.data[name]
        return {
            "id": name,
            "name": name,
            "gender": info.get("genre", "Inconnu"),
            "parents": info.get("parents", []),
            "children": info.get("enfants", []),
            "spouses": info.get("conjoints", []),
            "parents_details": [{"name": p, "gender": self.data[p].get("genre", "Inconnu")} for p in info.get("parents", []) if p in self.data],
            "children_details": [{"name": c, "gender": self.data[c].get("genre", "Inconnu")} for c in info.get("enfants", []) if c in self.data],
            "spouses_details": [{"name": s, "gender": self.data[s].get("genre", "Inconnu")} for s in info.get("conjoints", []) if s in self.data],
        }

    # -----------------------------
    # Arbres / sous-ensembles
    # -----------------------------
    def _get_related_people(self, start: str, direction: str, max_depth: int = 5) -> Set[str]:
        if start not in self.data:
            return set()
        visited, to_visit = set(), deque([(start, 0)])
        while to_visit:
            person, depth = to_visit.popleft()
            if person in visited or depth > max_depth:
                continue
            visited.add(person)
            rel = self.data[person].get("parents" if direction == "ancestors" else "enfants", [])
            for r in rel:
                if r not in visited:
                    to_visit.append((r, depth + 1))
        return visited

    def _get_family_subset(self, name: str, direction: str) -> Dict[str, Any]:
        related = self._get_related_people(name, direction)
        nodes = [{"id": n, "name": n, "gender": self.data[n].get("genre", "Inconnu")} for n in related if n in self.data]
        links = []
        for n in related:
            for e in self.data.get(n, {}).get("enfants", []):
                if e in related: links.append({"source": n, "target": e, "type": "parent"})
            for c in self.data.get(n, {}).get("conjoints", []):
                if c in related and n < c: links.append({"source": n, "target": c, "type": "spouse"})
        return {"nodes": nodes, "links": links}

    def get_ancestors(self, name: str): return self._get_family_subset(name, "ancestors")
    def get_descendants(self, name: str): return self._get_family_subset(name, "descendants")
    def get_hierarchical_tree(self): return self.get_hierarchical_tree_clean()

    def get_full_tree(self) -> Dict[str, Any]:
        nodes = self.get_all_people()
        links = []
        for n, i in self.data.items():
            for e in i.get("enfants", []):
                if e in self.data: links.append({"source": n, "target": e, "type": "parent"})
            for c in i.get("conjoints", []):
                if c in self.data and n < c: links.append({"source": n, "target": c, "type": "spouse"})
        return {"nodes": nodes, "links": links}

    # -----------------------------
    # Plus court chemin
    # -----------------------------
    def find_shortest_path(self, start: str, end: str) -> Optional[Dict[str, Any]]:
        if start not in self.data or end not in self.data:
            return None
        queue, visited = deque([(start, [start])]), set()
        while queue:
            current, path = queue.popleft()
            if current in visited: continue
            visited.add(current)
            if current == end:
                nodes = [{"id": n, "name": n, "gender": self.data[n].get("genre", "Inconnu")} for n in path]
                links = []
                for i in range(len(path) - 1):
                    a, b = path[i], path[i + 1]
                    if b in self.data[a].get("enfants", []): links.append({"source": a, "target": b, "type": "parent"})
                    elif a in self.data[b].get("enfants", []): links.append({"source": b, "target": a, "type": "parent"})
                    elif b in self.data[a].get("conjoints", []): links.append({"source": a, "target": b, "type": "spouse"})
                return {"nodes": nodes, "links": links}
            for neigh in set(self.data[current].get("parents", []) + self.data[current].get("enfants", []) + self.data[current].get("conjoints", [])):
                if neigh not in visited: queue.append((neigh, path + [neigh]))
        return None


# -----------------------------
# Initialisation
# -----------------------------
family_manager = FamilyDataManager(personnes_et_relations)


# -----------------------------
# Routes Flask
# -----------------------------
@app.route("/")
def index(): return render_template("index.html")

@app.route("/api/tree")
def api_tree(): return jsonify(family_manager.get_full_tree())

@app.route("/api/person/<name>")
def api_person(name):
    p = family_manager.get_person_details(name)
    return jsonify(p) if p else (jsonify({"error": "Personne non trouvée"}), 404)

@app.route("/api/ancestors/<name>")
def api_ancestors(name): return jsonify(family_manager.get_ancestors(name))

@app.route("/api/descendants/<name>")
def api_descendants(name): return jsonify(family_manager.get_descendants(name))

@app.route("/api/people")
def api_people(): return jsonify(family_manager.get_all_people())

@app.route("/api/hierarchical-tree")
def api_hierarchical_tree(): return jsonify(family_manager.get_hierarchical_tree_clean())

@app.route("/api/hierarchical-tree-limited")
def api_hierarchical_tree_limited():
    depth = min(request.args.get("depth", 4, type=int), 6)
    return jsonify(family_manager.get_hierarchical_tree_limited(depth))

@app.route("/api/search")
def api_search(): return jsonify(family_manager.search_people(request.args.get("q", "")))

@app.route("/api/relation-path")
def api_relation_path():
    p1, p2 = request.args.get("person1"), request.args.get("person2")
    if not p1 or not p2: return jsonify({"error": "Deux noms sont requis"}), 400
    path = family_manager.find_shortest_path(p1, p2)
    return jsonify(path) if path else (jsonify({"error": "Aucun chemin trouvé"}), 404)

@app.route("/api/validate")
def api_validate():
    errors = []
    for n, i in family_manager.data.items():
        for rel in ["parents", "enfants", "conjoints"]:
            for r in i.get(rel, []):
                if r not in family_manager.data:
                    errors.append(f"{n} référence un {rel[:-1]} inconnu : {r}")
    return (jsonify({"valid": False, "errors": errors}), 400) if errors else jsonify({"valid": True, "message": "✅ Toutes les références sont valides."})

@app.route("/api/stats")
def api_stats():
    total, roots = len(family_manager.data), [n for n, i in family_manager.data.items() if not i.get("parents", [])]
    generations, max_gen = {}, 0
    def calc(name, gen=0, visited=None):
        nonlocal max_gen
        visited = visited or set()
        if name in visited: return
        visited.add(name)
        generations[gen] = generations.get(gen, 0) + 1
        max_gen = max(max_gen, gen)
        for c in family_manager.data.get(name, {}).get("enfants", []): calc(c, gen + 1, visited.copy())
    for r in roots: calc(r)
    genders = {}
    for p in family_manager.data.values():
        g = p.get("genre", "Inconnu")
        genders[g] = genders.get(g, 0) + 1
    return jsonify({
        "total_people": total,
        "total_roots": len(roots),
        "max_generations": max_gen + 1,
        "generations_distribution": generations,
        "gender_distribution": genders,
        "roots": roots[:5]
    })


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
