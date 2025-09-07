import json
import uuid
import os

def convert_json_with_ids(input_file, output_file):
    """
    Lit un fichier JSON, attribue un ID unique à chaque personne et remplace
    les noms par ces IDs dans les relations (parents, enfants, conjoints).
    """
    if not os.path.exists(input_file):
        print(f"Erreur : Le fichier d'entrée '{input_file}' n'a pas été trouvé.")
        return

    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except json.JSONDecodeError:
        print(f"Erreur : Le fichier '{input_file}' n'est pas un JSON valide.")
        return

    personnes = data.get("personnes", [])
    if not personnes:
        print("Avertissement : La liste 'personnes' est vide ou introuvable.")
        return

    # Étape 1 : Créer un dictionnaire de correspondance nom -> ID
    # et attribuer un ID unique à chaque personne.
    # On utilise une liste d'IDs pour gérer les homonymes.
    name_to_id = {}
    for personne in personnes:
        personne['id'] = str(uuid.uuid4())
        name = personne['name']
        if name not in name_to_id:
            name_to_id[name] = []
        name_to_id[name].append(personne['id'])

    # Étape 2 : Créer une correspondance complète de nom_unique -> ID
    # pour gérer les homonymes.
    unique_name_to_id = {}
    for personne in personnes:
        parents = [p['name'] for p in personnes if personne['id'] in p.get('enfants', [])]
        conjoints = [c['name'] for c in personnes if personne['id'] in c.get('conjoints', [])]
        key = (personne['name'], tuple(sorted(parents)), tuple(sorted(conjoints)))
        unique_name_to_id[key] = personne['id']

    # Étape 3 : Remplacer les noms par les IDs dans les relations de chaque personne
    for personne in personnes:
        # Fonction utilitaire pour la conversion
        def replace_with_ids(relation_list, is_parent_list=False):
            new_list = []
            for name in relation_list:
                # Si le nom est un homonyme, on le gère manuellement
                if len(name_to_id.get(name, [])) > 1:
                    print(f"Homonyme non résolu pour le nom : '{name}'.")
                    # On ne remplace pas, car il est impossible de savoir de qui il s'agit.
                    new_list.append(name) 
                else:
                    # On utilise le dictionnaire pour une correspondance simple
                    person_id = name_to_id.get(name)
                    if person_id:
                        new_list.append(person_id[0])
                    else:
                        print(f"Avertissement : Nom '{name}' non trouvé pour la conversion.")
                        new_list.append(name) # Garde le nom si non trouvé pour éviter la perte de données
            return new_list

        personne['parents'] = replace_with_ids(personne.get('parents', []))
        personne['enfants'] = replace_with_ids(personne.get('enfants', []))
        personne['conjoints'] = replace_with_ids(personne.get('conjoints', []))

    # Étape 4 : Sauvegarder le nouveau JSON
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        print(f"Conversion terminée avec succès. Le fichier de sortie est '{output_file}'.")
    except Exception as e:
        print(f"Erreur lors de l'écriture du fichier : {e}")

# Nom des fichiers
input_file_name = "/home/gblack98/Téléchargements/genealogy/genealogie_famille_Diop/projet-arbre-genealogique/genealogy_data.json"
output_file_name = "/home/gblack98/Téléchargements/genealogy/genealogie_famille_Diop/projet-arbre-genealogique/arbre_avec_ids.json"

# Exécuter le script
convert_json_with_ids(input_file_name, output_file_name)