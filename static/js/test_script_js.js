// ==========================
// Variables globales et initialisation
// ==========================
let currentLayout = 'unified';
const svg = d3.select("#tree-svg");
let g = svg.append("g");

// Configuration du zoom
const zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on("zoom", (event) => g.attr("transform", event.transform));

svg.call(zoom);

// ==========================
// Initialisation principale
// ==========================
async function initFamilyView() {
    try {
        console.log("[init] Début initialisation...");
        
        // Essayer d'abord /api/hierarchical-tree
        let res = await fetch("/api/hierarchical-tree");
        if (res.ok) {
            const data = await res.json();
            if (data && data.personnes && data.personnes.length > 0) {
                console.log("[init] Données chargées :", data.personnes.length, "personnes");
                drawUnifiedFamilyTree(data);
                return;
            }
        }
        
        // Fallback vers /api/tree
        res = await fetch("/api/tree");
        if (res.ok) {
            const data = await res.json();
            if (data && data.nodes && data.nodes.length > 0) {
                console.log("[init] Données /api/tree chargées :", data.nodes.length, "nœuds");
                drawForceTree(data);
                return;
            }
        }
        
        console.error("[init] Aucune donnée utilisable trouvée");
        
    } catch (err) {
        console.error("[init] Erreur :", err);
    }
}

// ==========================
// Construction de l'arbre unifié (CORRIGÉ)
// ==========================
function buildUnifiedFamilyTree(personnes) {
    console.log("[buildUnified] Début construction avec", personnes.length, "personnes");
    
    const personMap = new Map();
    const nodes = [];
    
    // Créer les nœuds uniques
    personnes.forEach(person => {
        const node = {
            id: person.name,
            name: person.name,
            genre: person.genre || "Inconnu",
            parents: person.parents || [],
            enfants: person.enfants || [],
            conjoints: person.conjoints || [],
            generation: 0
        };
        nodes.push(node);
        personMap.set(person.name, node);
    });
    
    // Calculer les générations via BFS depuis les racines
    const visited = new Set();
    const queue = [];
    
    // Identifier les racines (personnes sans parents)
    nodes.forEach(node => {
        if (node.parents.length === 0) {
            node.generation = 0;
            queue.push(node);
            visited.add(node.name);
        }
    });
    
    // Propager les générations
    while (queue.length > 0) {
        const current = queue.shift();
        
        current.enfants.forEach(childName => {
            if (personMap.has(childName) && !visited.has(childName)) {
                const child = personMap.get(childName);
                child.generation = current.generation + 1;
                queue.push(child);
                visited.add(childName);
            }
        });
    }
    
    // Créer les liens
    const links = [];
    const linkSet = new Set();
    
    nodes.forEach(node => {
        // Liens parent → enfant (TOUS LES PARENTS)
        node.parents.forEach(parentName => {
            if (personMap.has(parentName)) {
                const linkId = `${parentName}->${node.name}`;
                if (!linkSet.has(linkId)) {
                    links.push({
                        source: parentName,
                        target: node.name,
                        type: 'parent'
                    });
                    linkSet.add(linkId);
                }
            }
        });
        
        // Liens conjoints
        node.conjoints.forEach(conjointName => {
            if (personMap.has(conjointName) && node.name < conjointName) {
                const linkId = `${node.name}<->${conjointName}`;
                if (!linkSet.has(linkId)) {
                    links.push({
                        source: node.name,
                        target: conjointName,
                        type: 'spouse'
                    });
                    linkSet.add(linkId);
                }
            }
        });
    });
    
    console.log("[buildUnified] Construit :", nodes.length, "nœuds,", links.length, "liens");
    return { nodes, links };
}

// ==========================
// Visualisation unifiée avec positionnement par génération
// ==========================
function drawUnifiedFamilyTree(data) {
    console.log("[drawUnified] Début affichage...");
    
    if (!data || (!data.nodes && !data.personnes)) {
        console.error("[drawUnified] Pas de données");
        return;
    }

    // Nettoyer le SVG
    svg.selectAll("*").remove();
    g = svg.append("g");

    const width = parseInt(svg.style("width")) || 1200;
    const height = parseInt(svg.style("height")) || 800;

    // Construire la structure unifiée
    let unifiedData;
    if (data.personnes) {
        unifiedData = buildUnifiedFamilyTree(data.personnes);
    } else {
        unifiedData = data;
    }

    if (!unifiedData.nodes || unifiedData.nodes.length === 0) {
        console.error("[drawUnified] Aucun nœud à afficher");
        return;
    }

    // Créer les définitions (gradients, marqueurs)
    setupSVGDefinitions();

    // Grouper par génération et positionner
    const generationGroups = groupByGeneration(unifiedData.nodes);
    const maxGeneration = Math.max(...unifiedData.nodes.map(n => n.generation));
    positionNodesByGeneration(generationGroups, maxGeneration, width, height);

    // Créer la simulation de forces
    const simulation = createSimulation(unifiedData, width, height, maxGeneration);
    
    // Dessiner liens et nœuds
    drawLinks(unifiedData.links);
    drawNodes(unifiedData.nodes);
    
    // Démarrer la simulation
    simulation.on("tick", () => {
        updatePositions();
    });
}

// ==========================
// Fonctions utilitaires pour l'affichage
// ==========================
function setupSVGDefinitions() {
    const defs = svg.append("defs");
    
    // Marqueur pour les flèches
    if (!defs.select("#arrowhead").node()) {
        defs.append("marker")
            .attr("id", "arrowhead")
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 18)
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,-5L10,0L0,5")
            .attr("fill", "#2196f3");
    }

    // Gradients
    if (!defs.select("#femmeGradient").node()) {
        const femmeGradient = defs.append("linearGradient")
            .attr("id", "femmeGradient");
        femmeGradient.append("stop").attr("offset", "0%").attr("stop-color", "#fce4ec");
        femmeGradient.append("stop").attr("offset", "100%").attr("stop-color", "#f8bbd9");

        const hommeGradient = defs.append("linearGradient")
            .attr("id", "hommeGradient");
        hommeGradient.append("stop").attr("offset", "0%").attr("stop-color", "#e3f2fd");
        hommeGradient.append("stop").attr("offset", "100%").attr("stop-color", "#bbdefb");
    }
}

function groupByGeneration(nodes) {
    const groups = {};
    nodes.forEach(node => {
        const gen = node.generation;
        if (!groups[gen]) groups[gen] = [];
        groups[gen].push(node);
    });
    return groups;
}

function positionNodesByGeneration(groups, maxGeneration, width, height) {
    const generationHeight = height / (maxGeneration + 2);
    
    Object.keys(groups).forEach(gen => {
        const genNumber = parseInt(gen);
        const nodesInGen = groups[gen];
        const genWidth = width / (nodesInGen.length + 1);
        
        nodesInGen.forEach((node, index) => {
            node.x = (index + 1) * genWidth;
            node.y = (genNumber + 1) * generationHeight;
            node.fx = node.x; // Position fixe initiale
            node.fy = node.y;
        });
    });
}

function createSimulation(unifiedData, width, height, maxGeneration) {
    const generationHeight = height / (maxGeneration + 2);
    
    return d3.forceSimulation(unifiedData.nodes)
        .force("link", d3.forceLink(unifiedData.links)
            .id(d => d.name || d.id)
            .distance(d => d.type === 'spouse' ? 200 : 150)
            .strength(0.1))
        .force("charge", d3.forceManyBody().strength(-200))
        .force("collision", d3.forceCollide().radius(85))
        .force("generation", d3.forceY(d => (d.generation + 1) * generationHeight).strength(0.8))
        .force("center", d3.forceX(width / 2).strength(0.02))
        .alphaDecay(0.02)
        .alphaMin(0.001);
}

function drawLinks(links) {
    const link = g.selectAll(".link")
        .data(links)
        .enter().append("line")
        .attr("class", d => `link ${d.type === 'spouse' ? 'spouse-link' : 'parent-link'}`)
        .attr("stroke", d => d.type === 'spouse' ? "#e91e63" : "#2196f3")
        .attr("stroke-width", d => d.type === 'spouse' ? 3 : 2)
        .attr("stroke-dasharray", d => d.type === 'spouse' ? "5,5" : "none")
        .attr("marker-end", d => d.type === 'parent' ? "url(#arrowhead)" : "none")
        .attr("opacity", 0.8);
}

function drawNodes(nodes) {
    const node = g.selectAll(".node")
        .data(nodes)
        .enter().append("g")
        .attr("class", "node")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended))
        .on("click", (event, d) => showPersonDetails(event, d))
        .on("mouseenter", function(event, d) {
            highlightConnections(d);
            highlightNode(this, true);
        })
        .on("mouseleave", function(event, d) {
            resetHighlight();
            highlightNode(this, false);
        });

    // Rectangle principal
    node.append("rect")
        .attr("width", 160)
        .attr("height", d => d.parents.length > 1 ? 70 : 60)
        .attr("x", -80)
        .attr("y", d => d.parents.length > 1 ? -35 : -30)
        .attr("rx", 15)
        .attr("ry", 15)
        .attr("fill", d => {
            if (d.genre === "Femme") return "url(#femmeGradient)";
            if (d.genre === "Homme") return "url(#hommeGradient)";
            return "#f8f9fa";
        })
        .attr("stroke", d => d.parents.length > 1 ? "#ff9800" : "none")
        .attr("stroke-width", d => d.parents.length > 1 ? 2 : 0)
        .attr("filter", "drop-shadow(2px 2px 4px rgba(0,0,0,0.2))");

    // Icône de genre
    node.append("text")
        .attr("x", -70)
        .attr("y", -10)
        .attr("font-size", "20px")
        .attr("font-weight", "bold")
        .attr("fill", d => d.genre === "Femme" ? "#e91e63" : "#2196f3")
        .text(d => d.genre === "Femme" ? "♀" : "♂");

    // Nom
    node.append("text")
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .attr("font-size", "13px")
        .attr("font-weight", "600")
        .attr("fill", "#333")
        .text(d => d.name.length > 18 ? d.name.substring(0, 15) + "..." : d.name);

    // Indicateur de génération
    node.append("circle")
        .attr("r", 12)
        .attr("cx", 65)
        .attr("cy", -15)
        .attr("fill", "#4caf50")
        .attr("stroke", "#2e7d32")
        .attr("stroke-width", 2);

    node.append("text")
        .attr("x", 65)
        .attr("y", -15)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .attr("font-weight", "bold")
        .attr("fill", "white")
        .text(d => `G${d.generation}`);

    // Indicateur multi-parents
    node.append("circle")
        .attr("r", d => d.parents.length > 1 ? 8 : 0)
        .attr("cx", -65)
        .attr("cy", 15)
        .attr("fill", "#ff9800")
        .attr("opacity", d => d.parents.length > 1 ? 1 : 0);

    node.append("text")
        .attr("x", -65)
        .attr("y", 15)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .attr("font-weight", "bold")
        .attr("fill", "white")
        .attr("opacity", d => d.parents.length > 1 ? 1 : 0)
        .text(d => d.parents.length > 1 ? d.parents.length : "");
}

function updatePositions() {
    g.selectAll(".link")
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

    g.selectAll(".node")
        .attr("transform", d => `translate(${d.x},${d.y})`);
}

// ==========================
// Fonctions d'interaction
// ==========================
function highlightConnections(selectedNode) {
    g.selectAll(".link").attr("opacity", 0.2);
    g.selectAll(".node rect").attr("opacity", 0.3);
    
    g.selectAll(".link").each(function(d) {
        const sourceName = d.source.name || d.source;
        const targetName = d.target.name || d.target;
        
        if (sourceName === selectedNode.name || targetName === selectedNode.name) {
            d3.select(this).attr("opacity", 1);
        }
    });
    
    g.selectAll(".node").each(function(d) {
        if (d.name === selectedNode.name || 
            selectedNode.parents.includes(d.name) ||
            selectedNode.enfants.includes(d.name) ||
            selectedNode.conjoints.includes(d.name)) {
            d3.select(this).select("rect").attr("opacity", 1);
        }
    });
}

function resetHighlight() {
    g.selectAll(".link").attr("opacity", 0.8);
    g.selectAll(".node rect").attr("opacity", 1);
}

function highlightNode(nodeElement, highlight) {
    d3.select(nodeElement).select("rect")
        .transition().duration(200)
        .attr("stroke", highlight ? "#ff6b6b" : function(d) { 
            return d.parents.length > 1 ? "#ff9800" : "none"; 
        })
        .attr("stroke-width", highlight ? 4 : function(d) { 
            return d.parents.length > 1 ? 2 : 0; 
        })
        .attr("filter", highlight ? 
            "drop-shadow(4px 4px 8px rgba(255,107,107,0.4))" : 
            "drop-shadow(2px 2px 4px rgba(0,0,0,0.2))");
}

// ==========================
// Gestion du drag
// ==========================
function dragstarted(event, d) {
    if (!event.active) {
        d3.select("#tree-svg").select("g").selectAll(".node").data().forEach(node => {
            if (node !== d) {
                const simulation = d3.forceSimulation().nodes();
                if (simulation.length > 0) {
                    simulation[0].alphaTarget(0.3).restart();
                }
            }
        });
    }
    d.fx = d.x;
    d.fy = d.y;
}

function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
}

function dragended(event, d) {
    if (!event.active) {
        const simulation = d3.forceSimulation().nodes();
        if (simulation.length > 0) {
            simulation[0].alphaTarget(0);
        }
    }
    d.fx = null;
    d.fy = null;
}

// ==========================
// Construction hiérarchique corrigée (pour vue hiérarchique)
// ==========================
function buildCleanHierarchy(personnes) {
    const personMap = new Map();
    
    personnes.forEach(person => {
        personMap.set(person.name, person);
    });
    
    // Identifier les racines
    const roots = personnes.filter(person => 
        !person.parents || person.parents.length === 0
    );
    
    function buildPersonNode(personName, visited = new Set()) {
        if (visited.has(personName)) return null;
        
        const person = personMap.get(personName);
        if (!person) return null;
        
        const newVisited = new Set([...visited, personName]);
        
        const node = {
            name: person.name,
            genre: person.genre,
            id: person.name,
            children: [],
            parents: person.parents || [],
            conjoints: person.conjoints || [],
            enfants: person.enfants || []
        };
        
        // Ajouter tous les enfants
        if (person.enfants && person.enfants.length > 0) {
            person.enfants.forEach(childName => {
                if (personMap.has(childName)) {
                    const childNode = buildPersonNode(childName, newVisited);
                    if (childNode) {
                        node.children.push(childNode);
                    }
                }
            });
        }
        
        return node;
    }
    
    const hierarchy = [];
    for (const root of roots) {
        const rootNode = buildPersonNode(root.name);
        if (rootNode) {
            hierarchy.push(rootNode);
        }
    }
    
    return hierarchy;
}

// ==========================
// Vue hiérarchique avec D3 tree
// ==========================
function drawHierarchicalTree(data) {
    if (!data || data.length === 0) return;

    svg.selectAll("*").remove();
    g = svg.append("g");

    const width = parseInt(svg.style("width")) || 1200;
    const height = parseInt(svg.style("height")) || 800;

    let hierarchyData = data;
    if (data.personnes) {
        hierarchyData = buildCleanHierarchy(data.personnes);
    }

    if (!hierarchyData || hierarchyData.length === 0) {
        console.error("Aucune donnée hiérarchique à afficher");
        return;
    }

    const rootData = { name: "Racine", children: hierarchyData };
    const root = d3.hierarchy(rootData);

    const treeLayout = d3.tree().size([height - 100, width - 200]);
    treeLayout(root);

    // Centrer l'arbre
    const nodes = root.descendants().slice(1); // Exclure la racine artificielle
    const links = root.links().filter(d => d.target.parent !== root); // Exclure liens vers racine

    if (nodes.length === 0) return;

    // Setup des définitions
    setupSVGDefinitions();

    // Dessiner les liens
    const link = g.selectAll(".hierarchy-link")
        .data(links)
        .enter().append("path")
        .attr("class", "hierarchy-link")
        .attr("fill", "none")
        .attr("stroke", "#666")
        .attr("stroke-width", 2)
        .attr("stroke-opacity", 0.7)
        .attr("marker-end", "url(#arrowhead)")
        .attr("d", d => `M${d.source.y},${d.source.x}C${(d.source.y + d.target.y) / 2},${d.source.x} ${(d.source.y + d.target.y) / 2},${d.target.x} ${d.target.y},${d.target.x}`);

    // Dessiner les nœuds
    const node = g.selectAll(".hierarchy-node")
        .data(nodes)
        .enter().append("g")
        .attr("class", "hierarchy-node")
        .attr("transform", d => `translate(${d.y},${d.x})`)
        .on("click", (event, d) => showPersonDetails(event, d.data));

    node.append("rect")
        .attr("width", 140)
        .attr("height", d => d.data.parents && d.data.parents.length > 1 ? 65 : 55)
        .attr("x", -70)
        .attr("y", d => d.data.parents && d.data.parents.length > 1 ? -32.5 : -27.5)
        .attr("rx", 12)
        .attr("ry", 12)
        .attr("fill", d => {
            if (d.data.genre === "Femme") return "url(#femmeGradient)";
            if (d.data.genre === "Homme") return "url(#hommeGradient)";
            return "#f8f9fa";
        })
        .attr("stroke", d => d.data.parents && d.data.parents.length > 1 ? "#ff9800" : "none")
        .attr("stroke-width", d => d.data.parents && d.data.parents.length > 1 ? 2 : 0);

    node.append("text")
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .attr("font-size", "13px")
        .attr("font-weight", "600")
        .attr("fill", "#333")
        .text(d => d.data.name);
}

// ==========================
// Vue force-directed (pour ancêtres/descendants)
// ==========================
function drawForceTree(data) {
    if (!data || !data.nodes || !data.links) return;

    svg.selectAll("*").remove();
    g = svg.append("g");

    const width = parseInt(svg.style("width")) || 1200;
    const height = parseInt(svg.style("height")) || 800;

    setupSVGDefinitions();

    const simulation = d3.forceSimulation(data.nodes)
        .force("link", d3.forceLink(data.links).id(d => d.id || d.name).distance(150))
        .force("charge", d3.forceManyBody().strength(-400))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(75));

    const link = g.selectAll(".force-link")
        .data(data.links)
        .enter().append("line")
        .attr("class", "force-link")
        .attr("stroke", d => d.type === 'spouse' ? "#e91e63" : "#666")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", d => d.type === 'spouse' ? "5,5" : "none")
        .attr("marker-end", d => d.type === 'parent' ? "url(#arrowhead)" : "none");

    const node = g.selectAll(".force-node")
        .data(data.nodes)
        .enter().append("g")
        .attr("class", "force-node")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended))
        .on("click", (event, d) => showPersonDetails(event, d));

    node.append("rect")
        .attr("width", 140)
        .attr("height", 50)
        .attr("x", -70)
        .attr("y", -25)
        .attr("rx", 10)
        .attr("ry", 10)
        .attr("fill", d => {
            if (d.gender === "Femme") return "url(#femmeGradient)";
            if (d.gender === "Homme") return "url(#hommeGradient)";
            return "#f8f9fa";
        });

    node.append("text")
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .attr("fill", "#333")
        .text(d => (d.name || d.id).length > 18 ? (d.name || d.id).substring(0, 15) + "..." : (d.name || d.id));

    simulation.on("tick", () => {
        link.attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node.attr("transform", d => `translate(${d.x},${d.y})`);
    });
}

// ==========================
// Texte multi-lignes pour noeuds
// ==========================

// Fonction pour wraper le texte (inchangée)
function wrapText(text, width) {
    text.each(function() {
        const textEl = d3.select(this);
        const words = textEl.text().split(/\s+/).reverse();
        let line = [];
        let lineNumber = 0;
        const lineHeight = 1.1;
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

document.getElementById("clear-tree").addEventListener("click", () => {
    const g = d3.select("#tree-svg").select("g");
    g.selectAll("*").remove();
});
