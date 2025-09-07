// ==========================
// Couleur par genre
// ==========================
export function getNodeColor(d) {
    const gender = d.data?.gender || d.gender;
    if (gender === "Femme") return "#ffe0e0"; // Rose clair
    if (gender === "Homme") return "#e0e0ff"; // Bleu clair
    return "#f0f0f0"; // Gris par défaut
}

// ==========================
// Texte multi-lignes pour noeuds
// ==========================
export function wrapText(text, width) {
    text.each(function() {
        const textEl = d3.select(this);
        const words = textEl.text().split(/\s+/).reverse();
        let line = [];
        let lineNumber = 0;
        const lineHeight = 1.2;
        const y = textEl.attr("y") || 0;
        const dy = parseFloat(textEl.attr("dy")) || 0;
        let tspan = textEl.text(null)
            .append("tspan")
            .attr("x", 0)
            .attr("y", y)
            .attr("dy", dy + "em");

        let word;
        while ((word = words.pop())) {
            line.push(word);
            tspan.text(line.join(" "));
            if (tspan.node().getComputedTextLength() > width) {
                line.pop();
                tspan.text(line.join(" "));
                line = [word];
                tspan = textEl.append("tspan")
                    .attr("x", 0)
                    .attr("y", y)
                    .attr("dy", ++lineNumber * lineHeight + dy + "em")
                    .text(word);
            }
        }
    });
}

// ==========================
// Formater une liste en chaîne de caractères
// ==========================
export function formatList(list) {
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
