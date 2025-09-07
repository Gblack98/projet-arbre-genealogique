#!/usr/bin/env python3
"""
Script de test pour l'application arbre généalogique
"""
import requests
import json

def test_api():
    base_url = "http://127.0.0.1:5000"
    
    print("🧪 Tests de l'API Arbre Généalogique")
    print("=" * 50)
    
    # Test 1: Arbre complet
    print("\n📊 Test 1: Chargement de l'arbre complet")
    try:
        response = requests.get(f"{base_url}/api/tree")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Succès: {len(data['nodes'])} nœuds, {len(data['links'])} liens")
        else:
            print(f"❌ Erreur: Status {response.status_code}")
    except Exception as e:
        print(f"❌ Erreur de connexion: {e}")
    
    # Test 2: Liste des personnes
    print("\n👥 Test 2: Liste des personnes")
    try:
        response = requests.get(f"{base_url}/api/people")
        if response.status_code == 200:
            people = response.json()
            print(f"✅ Succès: {len(people)} personnes")
            if people:
                print(f"   Premier: {people[0]['name']}")
        else:
            print(f"❌ Erreur: Status {response.status_code}")
    except Exception as e:
        print(f"❌ Erreur: {e}")
    
    # Test 3: Recherche
    print("\n🔍 Test 3: Recherche")
    try:
        response = requests.get(f"{base_url}/api/search?q=Diop")
        if response.status_code == 200:
            results = response.json()
            print(f"✅ Succès: {len(results)} résultats pour 'Diop'")
            for result in results[:3]:
                print(f"   - {result['name']}")
        else:
            print(f"❌ Erreur: Status {response.status_code}")
    except Exception as e:
        print(f"❌ Erreur: {e}")
    
    # Test 4: Détails d'une personne
    print("\n👤 Test 4: Détails d'une personne")
    try:
        test_person = "Gabar Diop"
        response = requests.get(f"{base_url}/api/person/{test_person}")
        if response.status_code == 200:
            person = response.json()
            print(f"✅ Succès: {person['name']}")
            print(f"   Genre: {person['gender']}")
            print(f"   Parents: {len(person.get('parents', []))}")
            print(f"   Enfants: {len(person.get('children', []))}")
        else:
            print(f"❌ Erreur: Status {response.status_code}")
    except Exception as e:
        print(f"❌ Erreur: {e}")
    
    # Test 5: Ancêtres
    print("\n⬆️  Test 5: Ancêtres")
    try:
        test_person = "Alioune Badara Gabar Diop"
        response = requests.get(f"{base_url}/api/ancestors/{test_person}")
        if response.status_code == 200:
            ancestors = response.json()
            print(f"✅ Succès: {len(ancestors['nodes'])} ancêtres, {len(ancestors['links'])} liens")
        else:
            print(f"❌ Erreur: Status {response.status_code}")
    except Exception as e:
        print(f"❌ Erreur: {e}")
    
    # Test 6: Descendants
    print("\n⬇️  Test 6: Descendants")
    try:
        test_person = "Birame Medor Diop"
        response = requests.get(f"{base_url}/api/descendants/{test_person}")
        if response.status_code == 200:
            descendants = response.json()
            print(f"✅ Succès: {len(descendants['nodes'])} descendants, {len(descendants['links'])} liens")
        else:
            print(f"❌ Erreur: Status {response.status_code}")
    except Exception as e:
        print(f"❌ Erreur: {e}")
    
    print("\n✨ Tests terminés!")

if __name__ == "__main__":
    print("Assurez-vous que l'application Flask est démarrée (python app.py)")
    input("Appuyez sur Entrée pour commencer les tests...")
    test_api()
