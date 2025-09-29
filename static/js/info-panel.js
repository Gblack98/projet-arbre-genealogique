// ==========================
// Afficher détails personne
// ==========================
function showPersonDetails(event, d) {
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
            alert("Impossible de charger les détails de cette personne.");
        });
}

function formatList(list) {
    if (!list || list.length === 0) return "—";
    return list.map(item => {
        // Si c'est déjà formaté avec genre, on le garde tel quel
        if (typeof item === "string" && (item.includes("♀") || item.includes("♂"))) {
            const parts = item.split(" (");
            const name = parts[0];
            return `<span class="person-link" data-name="${name}">${item}</span>`;
        } else {
            // Sinon, c'est juste un nom
            return `<span class="person-link" data-name="${item}">${item}</span>`;
        }
    }).join(", ");
}

// Gestion des clics sur les liens dans le panel
document.getElementById("info-content").addEventListener("click", (event) => {
    if (event.target.classList.contains("person-link")) {
        const name = event.target.dataset.name;
        document.getElementById("search-input").value = name;
        closePanel();

        // Afficher les descendants par défaut
        fetchAndDraw(`/api/descendants/${encodeURIComponent(name)}`, drawForceTree);
    }
});

// ==========================
// Fermer panel & overlay
// ==========================
document.getElementById("close-panel").addEventListener("click", closePanel);
document.getElementById("overlay").addEventListener("click", closePanel);

function closePanel() {
    document.getElementById("info-panel").classList.remove("active");
    document.getElementById("overlay").classList.remove("active");
}

