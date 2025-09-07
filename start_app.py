#!/usr/bin/env python3
"""
Script de démarrage simplifié pour l'arbre généalogique
"""
import os
import sys
import webbrowser
from time import sleep
import threading

def open_browser():
    """Ouvre le navigateur après un délai"""
    sleep(2)
    print("🌐 Ouverture du navigateur...")
    webbrowser.open("http://127.0.0.1:5000")

def main():
    print("🌳 Arbre Généalogique - Famille Diop")
    print("=" * 40)
    
    # Vérifier que Flask est installé
    try:
        import flask
        print(f"✅ Flask {flask.__version__} installé")
    except ImportError:
        print("❌ Flask n'est pas installé. Installez-le avec:")
        print("   pip install flask")
        sys.exit(1)
    
    # Vérifier que le fichier app.py existe
    if not os.path.exists("app.py"):
        print("❌ Le fichier app.py n'existe pas dans le répertoire courant")
        sys.exit(1)
    
    print("✅ Tous les fichiers requis sont présents")
    print("🚀 Démarrage du serveur...")
    print("\n📋 Instructions:")
    print("   - L'application sera disponible sur http://127.0.0.1:5000")
    print("   - Le navigateur s'ouvrira automatiquement")
    print("   - Utilisez Ctrl+C pour arrêter le serveur")
    print("\n" + "=" * 40)
    
    # Ouvrir le navigateur en arrière-plan
    browser_thread = threading.Thread(target=open_browser)
    browser_thread.daemon = True
    browser_thread.start()
    
    # Démarrer l'application
    from app import app
    app.run(host="127.0.0.1", port=5000, debug=False)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n🛑 Arrêt du serveur...")
        print("👋 Au revoir!")
    except Exception as e:
        print(f"\n❌ Erreur lors du démarrage: {e}")
        print("Vérifiez que tous les fichiers sont présents et que le port 5000 est libre.")
