
        // ==========================
        // Gestion du formulaire de relation
        // ==========================
        document.getElementById("show-relation").addEventListener("click", () => {
            document.getElementById("relation-modal").classList.add("active");
            document.getElementById("overlay").classList.add("active");
        });

        document.getElementById("close-relation-modal").addEventListener("click", () => {
            document.getElementById("relation-modal").classList.remove("active");
            document.getElementById("overlay").classList.remove("active");
        });

        document.getElementById("cancel-relation").addEventListener("click", () => {
            document.getElementById("relation-modal").classList.remove("active");
            document.getElementById("overlay").classList.remove("active");
        });

        document.getElementById("overlay").addEventListener("click", (event) => {
            if (event.target === document.getElementById("overlay")) {
                document.getElementById("relation-modal").classList.remove("active");
                document.getElementById("info-panel").classList.remove("active");
                document.getElementById("overlay").classList.remove("active");
            }
        });

        // ==========================
        // Suggestions pour les champs de relation
        // ==========================
        function setupRelationSuggestions(inputId, suggestionsId) {
            const input = document.getElementById(inputId);
            const suggestions = document.getElementById(suggestionsId);

            input.addEventListener("input", () => {
                const query = input.value.trim();
                if (!query) {
                    suggestions.style.display = "none";
                    return;
                }

                fetch(`/api/search?q=${encodeURIComponent(query)}`)
                    .then(res => res.json())
                    .then(results => {
                        suggestions.innerHTML = "";
                        if (results.length) {
                            results.forEach(p => {
                                const div = document.createElement("div");
                                div.className = "suggestion-item relation";
                                div.textContent = p.name;
                                div.addEventListener("click", () => {
                                    input.value = p.name;
                                    suggestions.style.display = "none";
                                });
                                suggestions.appendChild(div);
                            });
                            suggestions.style.display = "block";
                        } else {
                            suggestions.style.display = "none";
                        }
                    })
                    .catch(err => {
                        console.error("Erreur de recherche :", err);
                        suggestions.style.display = "none";
                    });
            });

            document.addEventListener("click", (event) => {
                if (event.target !== input && !suggestions.contains(event.target)) {
                    suggestions.style.display = "none";
                }
            });
        }

        // Initialiser les suggestions pour les deux champs
        setupRelationSuggestions("person1-input", "suggestions1");
        setupRelationSuggestions("person2-input", "suggestions2");

        // ==========================
        // Trouver la relation entre deux personnes
        // ==========================
        document.getElementById("find-relation").addEventListener("click", () => {
            const person1 = document.getElementById("person1-input").value.trim();
            const person2 = document.getElementById("person2-input").value.trim();

            if (!person1 || !person2) {
                alert("Veuillez entrer les noms des deux personnes.");
                return;
            }

            // Fermer le modal
            document.getElementById("relation-modal").classList.remove("active");
            document.getElementById("overlay").classList.remove("active");

            // Appeler une nouvelle API pour trouver le chemin entre les deux personnes
            fetch(`/api/relation-path?person1=${encodeURIComponent(person1)}&person2=${encodeURIComponent(person2)}`)
                .then(res => {
                    if (!res.ok) throw new Error("Relation non trouvée");
                    return res.json();
                })
                .then(data => {
                    // Afficher le graphe de relation
                    drawForceTree(data);
                    currentLayout = 'force';
                })
                .catch(err => {
                    console.error("Erreur :", err);
                    alert("Impossible de trouver une relation entre ces deux personnes.");
                });
        });

