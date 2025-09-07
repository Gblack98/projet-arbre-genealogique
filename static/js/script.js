// ==========================
// Initialisation SVG & Zoom
// ==========================
let currentLayout = 'hierarchical';
const svg = d3.select("#tree-svg");
let g = svg.append("g");

const zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on("zoom", (event) => g.attr("transform", event.transform));

svg.call(zoom);

// Contrôles de zoom
document.getElementById("zoom-in").addEventListener("click", () => svg.transition().duration(300).call(zoom.scaleBy, 1.3));
document.getElementById("zoom-out").addEventListener("click", () => svg.transition().duration(300).call(zoom.scaleBy, 0.7));
document.getElementById("reset-view").addEventListener("click", () => svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity));

// ==========================
// Chargement initial
// ==========================
fetch("/api/hierarchical-tree")
    .then(res => res.json())
    .then(data => {
        if (data && data.hierarchy && data.hierarchy.length > 0) {
            drawHierarchicalTree(data.hierarchy);
        } else {
            console.warn("Aucune donnée hiérarchique trouvée. Vérifiez vos racines.");
        }
    })
    .catch(err => console.error("Erreur au chargement initial :", err));

// ==========================
// Dessiner arbre hiérarchique
// ==========================
function drawHierarchicalTree(data) {
    if (!data || data.length === 0) return;

    svg.selectAll("*").remove();
    g = svg.append("g");

    const width = svg.node().clientWidth || 1200;
    const height = svg.node().clientHeight || 800;

    const rootData = { name: "Racines", children: data };
    const root = d3.hierarchy(rootData);

    root.x0 = height / 2;
    root.y0 = 0;

    const treeLayout = d3.tree().nodeSize([140, 220]);
    update(root);

    function update(source) {
        const treeData = treeLayout(root);
        const nodes = treeData.descendants();
        const links = treeData.links();

        // --- Liens ---
        const link = g.selectAll(".link")
            .data(links, d => `${d.source.data.id || d.source.data.name}-${d.target.data.id || d.target.data.name}`);

        const linkEnter = link.enter().append("path")
            .attr("class", "link")
            .attr("fill", "none")
            .attr("stroke", "#666")
            .attr("stroke-width", 2)
            .attr("stroke-opacity", 0.7)
            .attr("marker-end", "url(#arrowhead)")
            .attr("d", d => diagonal(source, source));

        link.merge(linkEnter)
            .transition().duration(500)
            .attr("d", d => diagonal(d.source, d.target));

        link.exit().remove();

        if (g.select("#arrowhead").empty()) {
            svg.append("defs").append("marker")
                .attr("id", "arrowhead")
                .attr("viewBox", "0 -5 10 10")
                .attr("refX", 15)
                .attr("refY", 0)
                .attr("markerWidth", 6)
                .attr("markerHeight", 6)
                .attr("orient", "auto")
                .append("path")
                .attr("d", "M0,-5L10,0L0,5")
                .attr("fill", "#666");
        }

        // --- Noeuds ---
        const node = g.selectAll(".node")
            .data(nodes, d => d.data.id || d.data.name);

        const nodeEnter = node.enter().append("g")
            .attr("class", "node")
            .attr("transform", d => `translate(${source.y0},${source.x0})`)
            .on("click", (event, d) => {
                if (d.children) {
                    d._children = d.children;
                    d.children = null;
                } else {
                    d.children = d._children;
                    d._children = null;
                }
                update(d);
                showPersonDetails(event, d);
            })
            .on("mouseenter", function(event, d) {
                d3.select(this).select("rect").transition().duration(200)
                    .attr("stroke", "#ff6b6b")
                    .attr("stroke-width", 3);
            })
            .on("mouseleave", function(event, d) {
                d3.select(this).select("rect").transition().duration(200)
                    .attr("stroke", "none");
            });

        nodeEnter.append("rect")
            .attr("width", 140)
            .attr("height", 50)
            .attr("x", -70)
            .attr("y", -25)
            .attr("rx", 10)
            .attr("ry", 10)
            .attr("fill", d => getNodeColor(d))
            .attr("stroke", "none")
            .attr("filter", "drop-shadow(2px 2px 3px rgba(0,0,0,0.2))");

        nodeEnter.append("text")
            .attr("x", -65)
            .attr("y", -10)
            .attr("font-size", "16px")
            .attr("fill", "#555")
            .text(d => d.data.gender === "Femme" ? "♀" : "♂");

        nodeEnter.append("text")
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .attr("font-size", "14px")
            .attr("fill", "#333")
            .text(d => d.data.name)
            .call(wrapText, 130);

        const nodeUpdate = node.merge(nodeEnter)
            .transition().duration(500)
            .attr("transform", d => `translate(${d.y},${d.x})`);

        node.exit()
            .transition().duration(500)
            .attr("transform", d => `translate(${source.y},${source.x})`)
            .remove();

        nodes.forEach(d => { d.x0 = d.x; d.y0 = d.y; });
    }

    function diagonal(s, d) {
        return `M${s.y},${s.x}
                C${(s.y + d.y) / 2},${s.x}
                 ${(s.y + d.y) / 2},${d.x}
                 ${d.y},${d.x}`;
    }
}

// ==========================
// Dessiner arbre force (ancêtres / descendants / complet)
// ==========================
function drawForceTree(data) {
    if (!data || !data.nodes || !data.links) return;

    svg.selectAll("*").remove();
    g = svg.append("g");

    const width = svg.node().clientWidth || 1200;
    const height = svg.node().clientHeight || 800;

    // Définir les marqueurs de flèche
    if (g.select("#arrowhead-force").empty()) {
        svg.append("defs").append("marker")
            .attr("id", "arrowhead-force")
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 15)
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,-5L10,0L0,5")
            .attr("fill", "#666");
    }

    // Simulation de force
    const simulation = d3.forceSimulation(data.nodes)
        .force("link", d3.forceLink(data.links).id(d => d.name).distance(150).strength(0.5))
        .force("charge", d3.forceManyBody().strength(-400))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(75))
        .alphaDecay(0.05)
        .alphaMin(0.01);

    // Liens : différencier parents et conjoints
    const link = g.selectAll(".link")
        .data(data.links)
        .enter().append("line")
        .attr("class", d => `link ${d.type === 'spouse' ? 'spouse-link' : 'parent-link'}`)
        .attr("stroke", d => d.type === 'spouse' ? "#ff6b9d" : "#666")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", d => d.type === 'spouse' ? "5,5" : "none")
        .attr("marker-end", d => d.type === 'parent' ? "url(#arrowhead-force)" : "none");

    // Noeuds
    const node = g.selectAll(".node")
        .data(data.nodes)
        .enter().append("g")
        .attr("class", "node")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended))
        .on("click", showPersonDetails)
        .on("mouseenter", function(event, d) {
            d3.select(this).select("rect").transition().duration(200)
                .attr("stroke", "#ff6b6b")
                .attr("stroke-width", 3);
        })
        .on("mouseleave", function(event, d) {
            d3.select(this).select("rect").transition().duration(200)
                .attr("stroke", "none");
        });

    node.append("rect")
        .attr("width", 140)
        .attr("height", 50)
        .attr("x", -70)
        .attr("y", -25)
        .attr("rx", 10)
        .attr("ry", 10)
        .attr("fill", d => getNodeColor(d))
        .attr("stroke", "none")
        .attr("filter", "drop-shadow(2px 2px 3px rgba(0,0,0,0.2))");

    node.append("text")
        .attr("x", -65)
        .attr("y", -10)
        .attr("font-size", "16px")
        .attr("fill", "#555")
        .text(d => d.gender === "Femme" ? "♀" : "♂");

    node.append("text")
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .attr("fill", "#333")
        .text(d => d.name.length > 18 ? d.name.substring(0, 15) + "..." : d.name)
        .call(wrapText, 130);

    simulation.on("tick", () => {
        link.attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
}

// ==========================
// Couleur par genre
// ==========================
function getNodeColor(d) {
    const gender = d.data?.gender || d.gender;
    if (gender === "Femme") return "#ffe0e0"; // Rose clair
    if (gender === "Homme") return "#e0e0ff"; // Bleu clair
    return "#f0f0f0"; // Gris par défaut
}

// ==========================
// Texte multi-lignes pour noeuds
// ==========================
function wrapText(text, width) {
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

// ==========================
// Boutons vue / recherche
// ==========================
function fetchAndDraw(url, drawFn) {
    fetch(url)
        .then(res => {
            if (!res.ok) throw new Error(`Erreur HTTP: ${res.status}`);
            return res.json();
        })
        .then(data => {
            if (drawFn === drawHierarchicalTree) {
                if (data.hierarchy && data.hierarchy.length > 0) {
                    drawFn(data.hierarchy);
                } else {
                    alert("Aucune hiérarchie trouvée. Vérifiez vos données sources.");
                }
            } else {
                if (data.nodes && data.nodes.length > 0) {
                    drawFn(data);
                } else {
                    alert("Aucune donnée trouvée pour cette personne.");
                }
            }
        })
        .catch(err => {
            console.error("Erreur lors du chargement :", err);
            alert("Une erreur est survenue lors du chargement des données.");
        });
}

document.getElementById("show-hierarchical").addEventListener("click", () => {
    currentLayout = 'hierarchical';
    fetchAndDraw("/api/hierarchical-tree", drawHierarchicalTree);
});

["show-ancestors", "show-descendants"].forEach(id => {
    document.getElementById(id).addEventListener("click", () => {
        const name = document.getElementById("search-input").value.trim();
        if (!name) return alert("Veuillez saisir un nom");
        currentLayout = 'force';
        const url = id === "show-ancestors"
            ? `/api/ancestors/${encodeURIComponent(name)}`
            : `/api/descendants/${encodeURIComponent(name)}`;
        fetchAndDraw(url, drawForceTree);
    });
});

document.getElementById("show-all").addEventListener("click", () => {
    currentLayout = 'force';
    fetchAndDraw("/api/tree", drawForceTree);
});

// ==========================
// Recherche avec suggestions
// ==========================
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

// ==========================
// Responsive : redimensionnement
// ==========================
window.addEventListener("resize", () => {
    if (currentLayout === 'hierarchical') {
        fetchAndDraw("/api/hierarchical-tree", drawHierarchicalTree);
    } else {
        const name = document.getElementById("search-input").value.trim();
        if (name) {
            const url = `/api/${currentLayout === 'force' ? 'descendants' : 'ancestors'}/${encodeURIComponent(name)}`;
            fetchAndDraw(url, drawForceTree);
        } else {
            fetchAndDraw("/api/tree", drawForceTree);
        }
    }
});