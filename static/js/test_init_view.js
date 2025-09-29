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
// Vue hiérarchique avec D3 tree + liens vers tous les parents
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

    // Créer un index des nœuds pour trouver les parents facilement
    const nodeIndex = new Map();
    nodes.forEach(node => {
        nodeIndex.set(node.data.name, node);
    });

    // AJOUT : Créer les liens supplémentaires vers TOUS les parents
    const additionalLinks = [];
    nodes.forEach(node => {
        if (node.data.parents && node.data.parents.length > 1) {
            node.data.parents.forEach(parentName => {
                const parentNode = nodeIndex.get(parentName);
                if (parentNode) {
                    // Vérifier si ce lien existe déjà dans la hiérarchie
                    const hierarchyLinkExists = links.some(link => 
                        link.source.data.name === parentName && 
                        link.target.data.name === node.data.name
                    );
                    
                    if (!hierarchyLinkExists) {
                        additionalLinks.push({
                            source: parentNode,
                            target: node,
                            type: 'additional-parent'
                        });
                    }
                }
            });
        }
    });

    // Dessiner les liens hiérarchiques normaux
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

    // AJOUT : Dessiner les liens supplémentaires vers les autres parents
    const additionalLink = g.selectAll(".additional-parent-link")
        .data(additionalLinks)
        .enter().append("path")
        .attr("class", "additional-parent-link")
        .attr("fill", "none")
        .attr("stroke", "#e91e63")
        .attr("stroke-width", 2)
        .attr("stroke-opacity", 0.7)
        .attr("stroke-dasharray", "5,5")
        .attr("marker-end", "url(#arrowhead)")
        .attr("d", d => `M${d.source.y},${d.source.x}C${(d.source.y + d.target.y) / 2},${d.source.x} ${(d.source.y + d.target.y) / 2},${d.target.x} ${d.target.y},${d.target.x}`);

    // Dessiner les nœuds
    const node = g.selectAll(".hierarchy-node")
        .data(nodes)
        .enter().append("g")
        .attr("class", "hierarchy-node")
        .attr("transform", d => `translate(${d.y},${d.x})`)
        .on("click", (event, d) => showPersonDetails(event, d.data))
        .on("mouseenter", function(event, d) {
            // Highlight des connexions pour cette personne
            g.selectAll(".hierarchy-link, .additional-parent-link")
                .attr("stroke-opacity", link => {
                    if ((link.source && link.source.data.name === d.data.name) ||
                        (link.target && link.target.data.name === d.data.name)) {
                        return 1;
                    }
                    return 0.2;
                });
            
            d3.select(this).select("rect")
                .attr("stroke", "#ff6b6b")
                .attr("stroke-width", 3);
        })
        .on("mouseleave", function(event, d) {
            g.selectAll(".hierarchy-link, .additional-parent-link")
                .attr("stroke-opacity", 0.7);
            
            d3.select(this).select("rect")
                .attr("stroke", d => d.data.parents && d.data.parents.length > 1 ? "#ff9800" : "none")
                .attr("stroke-width", d => d.data.parents && d.data.parents.length > 1 ? 2 : 0);
        });

    // Rectangle principal avec indication multi-parents
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
        .attr("stroke-width", d => d.data.parents && d.data.parents.length > 1 ? 2 : 0)
        .attr("filter", "drop-shadow(2px 2px 3px rgba(0,0,0,0.2))");

    // Icône de genre
    node.append("text")
        .attr("x", -60)
        .attr("y", -8)
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .attr("fill", d => d.data.genre === "Femme" ? "#e91e63" : "#2196f3")
        .text(d => d.data.genre === "Femme" ? "♀" : "♂");

    // Nom de la personne
    node.append("text")
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .attr("font-weight", "600")
        .attr("fill", "#333")
        .text(d => d.data.name.length > 16 ? d.data.name.substring(0, 13) + "..." : d.data.name);

    // Indicateur multi-parents (cercle orange avec nombre)
    node.append("circle")
        .attr("r", d => d.data.parents && d.data.parents.length > 1 ? 8 : 0)
        .attr("cx", 55)
        .attr("cy", -20)
        .attr("fill", "#ff9800")
        .attr("opacity", d => d.data.parents && d.data.parents.length > 1 ? 1 : 0);

    node.append("text")
        .attr("x", 55)
        .attr("y", -20)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .attr("font-weight", "bold")
        .attr("fill", "white")
        .attr("opacity", d => d.data.parents && d.data.parents.length > 1 ? 1 : 0)
        .text(d => d.data.parents && d.data.parents.length > 1 ? d.data.parents.length : "");

    // Centrer la vue sur l'arbre
    setTimeout(centerView, 100);
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
// Affichage des détails d'une personne
// ==========================
function showPersonDetails(event, d) {
    const person = d.data || d;
    
    // Créer ou récupérer le panneau de détails
    let detailsPanel = document.getElementById('person-details-panel');
    if (!detailsPanel) {
        detailsPanel = document.createElement('div');
        detailsPanel.id = 'person-details-panel';
        detailsPanel.style.cssText = `
            position: absolute;
            background: white;
            border: 2px solid #3498db;
            border-radius: 10px;
            padding: 15px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            max-width: 350px;
            z-index: 1001;
            display: none;
            font-family: Arial, sans-serif;
        `;
        document.body.appendChild(detailsPanel);
    }
    
    let parentsText = 'Aucun parent';
    if (person.parents && person.parents.length > 0) {
        parentsText = person.parents.join(', ');
        if (person.parents.length > 1) {
            parentsText += ` (${person.parents.length} parents)`;
        }
    }
    
    const enfantsText = person.enfants && person.enfants.length > 0 ? 
        person.enfants.join(', ') : 'Aucun enfant';
    const conjointsText = person.conjoints && person.conjoints.length > 0 ? 
        person.conjoints.join(', ') : 'Aucun conjoint';
    
    detailsPanel.innerHTML = `
        <div style="border-bottom: 2px solid #3498db; padding-bottom: 10px; margin-bottom: 10px;">
            <h3 style="margin: 0; color: #2c3e50;">
                ${person.genre === "Femme" ? "♀" : "♂"} ${person.name}
            </h3>
        </div>
        <div style="margin-bottom: 8px;"><strong>Genre:</strong> ${person.genre}</div>
        <div style="margin-bottom: 8px;"><strong>Parents:</strong> ${parentsText}</div>
        <div style="margin-bottom: 8px;"><strong>Enfants:</strong> ${enfantsText}</div>
        <div style="margin-bottom: 15px;"><strong>Conjoints:</strong> ${conjointsText}</div>
        ${person.generation !== undefined ? `<div style="margin-bottom: 15px;"><strong>Génération:</strong> ${person.generation}</div>` : ''}
        <button onclick="this.parentElement.style.display='none'" 
                style="background: #3498db; color: white; border: none; padding: 8px 16px; 
                       border-radius: 5px; cursor: pointer; float: right;">
            Fermer
        </button>
        <div style="clear: both;"></div>
    `;
    
    // Positionner le panneau
    const rect = detailsPanel.getBoundingClientRect();
    let x = event.pageX + 10;
    let y = event.pageY + 10;
    
    // Ajuster si le panneau sort de l'écran
    if (x + 350 > window.innerWidth) {
        x = event.pageX - 350 - 10;
    }
    if (y + 200 > window.innerHeight) {
        y = event.pageY - 200 - 10;
    }
    
    detailsPanel.style.left = Math.max(10, x) + 'px';
    detailsPanel.style.top = Math.max(10, y) + 'px';
    detailsPanel.style.display = 'block';
    
    // Fermer automatiquement au clic ailleurs
    setTimeout(() => {
        const closeHandler = (e) => {
            if (!detailsPanel.contains(e.target)) {
                detailsPanel.style.display = 'none';
                document.removeEventListener('click', closeHandler);
            }
        };
        document.addEventListener('click', closeHandler);
    }, 100);
}

// ==========================
// Gestion des événements et contrôles
// ==========================

// Contrôles de zoom
document.getElementById("zoom-in")?.addEventListener("click", () => {
    svg.transition().duration(300).call(zoom.scaleBy, 1.3);
});

document.getElementById("zoom-out")?.addEventListener("click", () => {
    svg.transition().duration(300).call(zoom.scaleBy, 0.7);
});

document.getElementById("reset-view")?.addEventListener("click", () => {
    svg.transition().duration(500).call(
        zoom.transform,
        d3.zoomIdentity
    );
});

// Bouton pour relancer la vue unifiée
document.getElementById("show-unified")?.addEventListener("click", () => {
    currentLayout = 'unified';
    initFamilyView();
});

// Vue hiérarchique
document.getElementById("show-hierarchical")?.addEventListener("click", () => {
    currentLayout = 'hierarchical';
    fetch("/api/hierarchical-tree")
        .then(res => res.json())
        .then(data => {
            if (data.personnes) {
                drawHierarchicalTree(data);
            }
        })
        .catch(err => console.error("Erreur chargement hiérarchique:", err));
});

// Ancêtres et descendants
document.getElementById("show-ancestors")?.addEventListener("click", () => {
    const name = document.getElementById("search-input")?.value.trim();
    if (!name) {
        alert("Veuillez saisir un nom dans le champ de recherche");
        return;
    }
    
    currentLayout = 'force';
    fetch(`/api/ancestors/${encodeURIComponent(name)}`)
        .then(res => res.json())
        .then(data => drawForceTree(data))
        .catch(err => {
            console.error("Erreur ancêtres:", err);
            alert("Impossible de charger les ancêtres pour cette personne");
        });
});

document.getElementById("show-descendants")?.addEventListener("click", () => {
    const name = document.getElementById("search-input")?.value.trim();
    if (!name) {
        alert("Veuillez saisir un nom dans le champ de recherche");
        return;
    }
    
    currentLayout = 'force';
    fetch(`/api/descendants/${encodeURIComponent(name)}`)
        .then(res => res.json())
        .then(data => drawForceTree(data))
        .catch(err => {
            console.error("Erreur descendants:", err);
            alert("Impossible de charger les descendants pour cette personne");
        });
});

// Arbre complet
document.getElementById("show-all")?.addEventListener("click", () => {
    currentLayout = 'force';
    fetch("/api/tree")
        .then(res => res.json())
        .then(data => drawForceTree(data))
        .catch(err => console.error("Erreur arbre complet:", err));
});

// ==========================
// Système de recherche avec suggestions
// ==========================
const searchInput = document.getElementById("search-input");
const suggestionsContainer = document.getElementById("suggestions");

if (searchInput && suggestionsContainer) {
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
                    results.forEach(person => {
                        const div = document.createElement("div");
                        div.className = "suggestion-item";
                        div.style.cssText = `
                            padding: 8px 12px;
                            cursor: pointer;
                            border-bottom: 1px solid #eee;
                            background: white;
                        `;
                        div.textContent = `${person.name} (${person.gender})`;
                        
                        div.addEventListener("click", () => {
                            searchInput.value = person.name;
                            suggestionsContainer.style.display = "none";
                        });
                        
                        div.addEventListener("mouseenter", () => {
                            div.style.background = "#f0f0f0";
                        });
                        
                        div.addEventListener("mouseleave", () => {
                            div.style.background = "white";
                        });
                        
                        suggestionsContainer.appendChild(div);
                    });
                    suggestionsContainer.style.display = "block";
                    suggestionsContainer.style.position = "absolute";
                    suggestionsContainer.style.background = "white";
                    suggestionsContainer.style.border = "1px solid #ccc";
                    suggestionsContainer.style.borderRadius = "4px";
                    suggestionsContainer.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
                    suggestionsContainer.style.maxHeight = "200px";
                    suggestionsContainer.style.overflowY = "auto";
                    suggestionsContainer.style.zIndex = "1000";
                } else {
                    suggestionsContainer.style.display = "none";
                }
            })
            .catch(err => {
                console.error("Erreur de recherche:", err);
                suggestionsContainer.style.display = "none";
            });
    });

    // Fermer les suggestions quand on clique ailleurs
    document.addEventListener("click", (event) => {
        if (!searchInput.contains(event.target) && !suggestionsContainer.contains(event.target)) {
            suggestionsContainer.style.display = "none";
        }
    });
}

// ==========================
// Nettoyage et responsive
// ==========================
document.getElementById("clear-tree")?.addEventListener("click", () => {
    svg.selectAll("*").remove();
    g = svg.append("g");
});

// Gestion du redimensionnement
window.addEventListener("resize", () => {
    clearTimeout(window.resizeTimeout);
    window.resizeTimeout = setTimeout(() => {
        if (currentLayout === 'unified') {
            initFamilyView();
        }
    }, 250);
});

// ==========================
// Fonctions utilitaires supplémentaires
// ==========================
function fetchAndDraw(url, drawFunction) {
    return fetch(url)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then(data => {
            if (!data) throw new Error("Aucune donnée reçue");
            drawFunction(data);
        })
        .catch(err => {
            console.error(`Erreur lors du chargement de ${url}:`, err);
            alert(`Erreur: ${err.message}`);
        });
}

function centerView() {
    const bounds = g.node().getBBox();
    if (bounds.width === 0 || bounds.height === 0) return;
    
    const width = parseInt(svg.style("width")) || 1200;
    const height = parseInt(svg.style("height")) || 800;
    
    const scale = Math.min(
        width / bounds.width,
        height / bounds.height
    ) * 0.9;
    
    const translate = [
        width / 2 - scale * (bounds.x + bounds.width / 2),
        height / 2 - scale * (bounds.y + bounds.height / 2)
    ];
    
    svg.transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
}

// Fonction de debug pour afficher les informations sur les données
function debugData(data) {
    if (!data) {
        console.log("DEBUG: Pas de données");
        return;
    }
    
    if (data.personnes) {
        console.log("DEBUG: Format personnes -", data.personnes.length, "personnes");
        console.log("DEBUG: Exemple personne:", data.personnes[0]);
    } else if (data.nodes) {
        console.log("DEBUG: Format nodes/links -", data.nodes.length, "nœuds,", data.links?.length || 0, "liens");
        console.log("DEBUG: Exemple nœud:", data.nodes[0]);
    } else {
        console.log("DEBUG: Format inconnu:", Object.keys(data));
    }
}

// ==========================
// Lancement automatique
// ==========================
document.addEventListener('DOMContentLoaded', function() {
    console.log("[DOM] Page chargée, initialisation...");
    setTimeout(initFamilyView, 100); // Petit délai pour s'assurer que tout est prêt
});

// Si le DOM est déjà chargé
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFamilyView);
} else {
    initFamilyView();
}
