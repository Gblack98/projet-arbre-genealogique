import { fetchAndDraw } from './core.js';
import { drawForceTree } from './tree-force.js';
import { formatList } from './utils.js';

// ==========================
// Afficher les détails d'une personne dans le panneau d'information
// ==========================
export function showPersonDetails(event, d) {
    const personId = d.data?.id || d.id;
    if (!personId) return;

    fetch(`/api/person/${encodeURIComponent(personId)}`)
        .then(res => {
            if (!res.ok) throw new Error("Personne non trouvée");
            return res.json();
        })
        .then(info => {
            const panel = document.getElementById("info-panel");
            const nameEl = document.getElementById("info-name");
            const contentEl = document.getElementById("info-content");

            nameEl.textContent = info.name || "Inconnu(e)";

            // Formater avec genre à côté du nom
            const parentsWithGender = info.parents_details?.map(p => `${p.name} (${p.gender === "Femme" ? "♀" : "♂"})`) || info.parents;
            const childrenWithGender = info.children_details?.map(c => `${c.name} (${c.gender === "Femme" ? "♀" : "♂"})`) || info.children;
            const spousesWithGender = info.spouses_details?.map(s => `${s.name} (${s.gender === "Femme" ? "♀" : "♂"})`) || info.spouses;

            contentEl.innerHTML = `
                <div class="info-row"><b>Genre :</b> ${info.gender || "—"} ${info.gender === "Femme" ? "♀" : info.gender === "Homme" ? "♂" : ""}</div>
                <div class="info-row"><b>Parents :</b> ${formatList(parentsWithGender)}</div>
                <div class="info-row"><b>Enfants :</b> ${formatList(childrenWithGender)}</div>
                <div class="info-row"><b>Conjoints :</b> ${formatList(spousesWithGender)}</div>
            `;

            panel.classList.add("active");
            document.getElementById("overlay").classList.add("active");

            // Positionner près du clic
            const rect = panel.getBoundingClientRect();
            const x = event.clientX + 20;
            const y = event.clientY - rect.height / 2;

            panel.style.left = `${Math.min(x, window.innerWidth - rect.width - 20)}px`;
            panel.style.top = `${Math.max(20, Math.min(y, window.innerHeight - rect.height - 20))}px`;
        })
        .catch(err => {
            console.error("Erreur :", err);
            // Using custom alert-like message instead of window.alert
            const message = "Impossible de charger les détails de cette personne.";
            const messageBox = document.createElement('div');
            messageBox.textContent = message;
            messageBox.style.cssText = `
                position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
                padding: 15px; background: #fff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.2);
                z-index: 999; animation: fadeOut 3s forwards;
            `;
            document.body.appendChild(messageBox);
        });
}

// ==========================
// Fermer le panneau d'information et l'overlay
// ==========================
export function closePanel() {
    document.getElementById("info-panel").classList.remove("active");
    document.getElementById("overlay").classList.remove("active");
}

// ==========================
// Gestion des événements UI
// ==========================

// Fermer le panel & l'overlay
document.getElementById("close-panel").addEventListener("click", closePanel);
document.getElementById("overlay").addEventListener("click", closePanel);

// Gestion des clics sur les liens dans le panel
document.getElementById("info-content").addEventListener("click", (event) => {
    if (event.target.classList.contains("person-link")) {
        const name = event.target.dataset.name;
        document.getElementById("search-input").value = name;
        closePanel();
        fetchAndDraw(`/api/descendants/${encodeURIComponent(name)}`, drawForceTree);
    }
});

// Recherche avec suggestions
const searchInput = document.getElementById("search-input");
const suggestionsContainer = document.getElementById("suggestions");

searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim();
    if (!query) {
        suggestionsContainer.style.display = "none";
        return;
    }

    fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then(res => res.json())
        .then(results => {
            suggestionsContainer.innerHTML = "";
            if (results.length) {
                results.forEach(p => {
                    const div = document.createElement("div");
                    div.className = "suggestion-item";
                    div.textContent = p.name;
                    div.addEventListener("click", () => {
                        searchInput.value = p.name;
                        suggestionsContainer.style.display = "none";
                    });
                    suggestionsContainer.appendChild(div);
                });
                suggestionsContainer.style.display = "block";
            } else {
                suggestionsContainer.style.display = "none";
            }
        })
        .catch(err => {
            console.error("Erreur de recherche :", err);
            suggestionsContainer.style.display = "none";
        });
});

document.addEventListener("click", (event) => {
    if (event.target !== searchInput && !suggestionsContainer.contains(event.target)) {
        suggestionsContainer.style.display = "none";
    }
});
