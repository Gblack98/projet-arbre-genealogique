#!/usr/bin/env python3
"""
Script de diagnostic pour l'arbre généalogique
"""
import sys
import os
import json

def test_data_integrity():
    """Teste l'intégrité des données"""
    print("🔍 Test d'intégrité des données")
    print("-" * 30)
    
    # Charger les données depuis app.py
    sys.path.append('.')
    try:
        from app import personnes_et_relations, family_manager
        
        print(f"✅ Données chargées: {len(personnes_et_relations)} personnes")
        
        # Vérifier quelques personnes clés
        test_people = ["Gabar Diop", "Birame Medor Diop", "Alioune Badara Gabar Diop"]
        
        for person in test_people:
            if person in personnes_et_relations:
                info = personnes_et_relations[person]
                print(f"✅ {person}: {info.get('genre', 'N/A')} - "
                      f"{len(info.get('enfants', []))} enfants - "
                      f"{len(info.get('parents', []))} parents")
            else:
                print(f"❌ {person}: Non trouvé")
        
        # Test du gestionnaire
        print(f"\n📊 Gestionnaire de données:")
        all_people = family_manager.get_all_people()
        print(f"✅ Total personnes: {len(all_people)}")
        
        # Test recherche
        search_results = family_manager.search_people("Diop")
        print(f"✅ Recherche 'Diop': {len(search_results)} résultats")
        
        # Test arbre complet
        full_tree = family_manager.get_full_tree()
        print(f"✅ Arbre complet: {len(full_tree['nodes'])} nœuds, {len(full_tree['links'])} liens")
        
        return True
        
    except Exception as e:
        print(f"❌ Erreur: {e}")
        return False

def test_flask_routes():
    """Teste les routes Flask sans serveur"""
    print("\n🌐 Test des routes Flask")
    print("-" * 30)
    
    try:
        from app import app
        
        with app.test_client() as client:
            # Test page d'accueil
            response = client.get('/')
            print(f"✅ Route /: Status {response.status_code}")
            
            # Test API tree
            response = client.get('/api/tree')
            if response.status_code == 200:
                data = response.get_json()
                print(f"✅ API /api/tree: {len(data['nodes'])} nœuds")
            else:
                print(f"❌ API /api/tree: Status {response.status_code}")
            
            # Test API people
            response = client.get('/api/people')
            if response.status_code == 200:
                data = response.get_json()
                print(f"✅ API /api/people: {len(data)} personnes")
            else:
                print(f"❌ API /api/people: Status {response.status_code}")
            
            # Test recherche
            response = client.get('/api/search?q=Gabar')
            if response.status_code == 200:
                data = response.get_json()
                print(f"✅ API /api/search: {len(data)} résultats")
            else:
                print(f"❌ API /api/search: Status {response.status_code}")
                
            # Test détails personne
            response = client.get('/api/person/Gabar%20Diop')
            if response.status_code == 200:
                data = response.get_json()
                print(f"✅ API /api/person: {data['name']}")
            else:
                print(f"❌ API /api/person: Status {response.status_code}")
                
        return True
        
    except Exception as e:
        print(f"❌ Erreur: {e}")
        return False

def check_dependencies():
    """Vérifie les dépendances"""
    print("\n📦 Vérification des dépendances")
    print("-" * 30)
    
    dependencies = ['flask']
    all_ok = True
    
    for dep in dependencies:
        try:
            __import__(dep)
            print(f"✅ {dep}: Installé")
        except ImportError:
            print(f"❌ {dep}: Non installé")
            all_ok = False
    
    return all_ok

def check_files():
    """Vérifie la présence des fichiers"""
    print("\n📁 Vérification des fichiers")
    print("-" * 30)
    
    required_files = ['app.py']
    optional_files = ['requirements.txt', 'test_app.py']
    
    all_ok = True
    
    for file in required_files:
        if os.path.exists(file):
            print(f"✅ {file}: Présent")
        else:
            print(f"❌ {file}: Manquant")
            all_ok = False
    
    for file in optional_files:
        if os.path.exists(file):
            print(f"✅ {file}: Présent")
        else:
            print(f"⚠️  {file}: Optionnel (manquant)")
    
    return all_ok

def main():
    print("🏥 Diagnostic Arbre Généalogique")
    print("=" * 50)
    
    results = []
    
    # Tests
    results.append(("Fichiers", check_files()))
    results.append(("Dépendances", check_dependencies()))
    results.append(("Données", test_data_integrity()))
    results.append(("Routes Flask", test_flask_routes()))
    
    # Résumé
    print("\n📋 Résumé du diagnostic")
    print("=" * 50)
    
    all_passed = True
    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{test_name:20s}: {status}")
        if not passed:
            all_passed = False
    
    print("\n" + "=" * 50)
    if all_passed:
        print("🎉 Tous les tests sont passés!")
        print("   L'application devrait fonctionner correctement.")
        print("   Lancez: python app.py")
    else:
        print("⚠️  Certains tests ont échoué.")
        print("   Vérifiez les erreurs ci-dessus avant de lancer l'application.")
    
    return all_passed

if __name__ == "__main__":
    main()
