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

// Nouveau : relancer la vue unifiée
document.getElementById("reset-view").addEventListener("click", () => {
    g.selectAll("*").remove(); // nettoyer le SVG
    initFamilyView();          // relancer l'affichage unifié
});


// ==========================
// Initialisation améliorée : charger /api/tree puis normaliser
// ==========================
async function initFamilyView() {
    try {
        // 1) Essayer /api/tree (format nodes + links)
        let res = await fetch("/api/tree");
        if (res.ok) {
            let data = await res.json();
            if (data && data.nodes && data.links) {
                // Normaliser les noeuds (id/name/genre)
                data.nodes = data.nodes.map(n => ({
                    id: n.id || n.name,
                    name: n.name || n.id,
                    genre: n.genre || n.gender || "Inconnu",
                    ...n
                }));

                // Calculer les générations à partir des liens parent→enfant
                computeGenerationsFromLinks(data);

                console.log("[init] Chargé /api/tree :", data.nodes.length, "nœuds,", data.links.length, "liens");
                drawUnifiedFamilyTree(data);
                return;
            }
        } else {
            console.warn("[init] /api/tree status:", res.status);
        }

        // 2) Fallback : /api/hierarchical-tree (format { hierarchy, personnes })
        res = await fetch("/api/hierarchical-tree");
        if (res.ok) {
            const data = await res.json();
            if (data && data.personnes) {
                console.log("[init] Chargé /api/hierarchical-tree (personnes) :", data.personnes.length);
                drawUnifiedFamilyTree(data); // ta fonction gère data.personnes
                return;
            }
        } else {
            console.warn("[init] /api/hierarchical-tree status:", res.status);
        }

        console.error("[init] Aucune donnée utilisable trouvée.");
    } catch (err) {
        console.error("[init] Erreur initialisation :", err);
    }
}

function computeGenerationsFromLinks(graph) {
    // Préparer parents[] sur chaque noeud
    const nodeById = new Map(graph.nodes.map(n => [n.id, n]));
    graph.nodes.forEach(n => { n.parents = []; });

    graph.links.forEach(l => {
        // source/target peuvent être des objets (après conversion) ou des strings
        const src = (typeof l.source === "object") ? (l.source.id || l.source.name) : l.source;
        const tgt = (typeof l.target === "object") ? (l.target.id || l.target.name) : l.target;
        if (l.type === "parent") {
            if (nodeById.has(tgt)) nodeById.get(tgt).parents.push(src);
        }
    });

    // Racines = noeuds sans parents
    const roots = graph.nodes.filter(n => !n.parents || n.parents.length === 0).map(n => n.id);

    const genMap = new Map();
    const queue = [];

    // Si on a des racines, on les met à génération 0
    if (roots.length > 0) {
        roots.forEach(r => { genMap.set(r, 0); queue.push(r); });
    } else {
        // Pas de racine détectée (cycle/format étrange) -> choisir noeuds avec le moins de parents comme racines
        let minParents = Infinity;
        graph.nodes.forEach(n => { minParents = Math.min(minParents, (n.parents && n.parents.length) || 0); });
        graph.nodes.forEach(n => {
            const pc = (n.parents && n.parents.length) || 0;
            if (pc === minParents) { genMap.set(n.id, 0); queue.push(n.id); }
        });
    }

    // BFS : propager vers les enfants (links parent → child)
    while (queue.length > 0) {
        const cur = queue.shift();
        const curGen = genMap.get(cur);
        // trouver enfants directs
        graph.links.forEach(l => {
            const src = (typeof l.source === "object") ? (l.source.id || l.source.name) : l.source;
            const tgt = (typeof l.target === "object") ? (l.target.id || l.target.name) : l.target;
            if (l.type === "parent" && src === cur) {
                const newGen = curGen + 1;
                if (!genMap.has(tgt) || newGen > genMap.get(tgt)) {
                    genMap.set(tgt, newGen);
                    queue.push(tgt);
                }
            }
        });
    }

    // Appliquer aux noeuds (fallback 0)
    graph.nodes.forEach(n => {
        n.generation = genMap.has(n.id) ? genMap.get(n.id) : 0;
    });
}

// Lancer l'init
initFamilyView();






// ==========================
// Fonction pour construire un arbre généalogique unifié (DAG)
// ==========================
function buildUnifiedFamilyTree(persons) {
    const personMap = new Map();
    const allPersons = new Map();
    
    // Créer une map de toutes les personnes
    persons.forEach(person => {
        allPersons.set(person.name, person);
    });
    
    // Créer les nœuds uniques
    const nodes = [];
    const nodeMap = new Map();
    
    persons.forEach(person => {
        if (!nodeMap.has(person.name)) {
            const node = {
                id: person.name,
                name: person.name,
                genre: person.genre,
                parents: person.parents || [],
                enfants: person.enfants || [],
                conjoints: person.conjoints || [],
                x: 0,
                y: 0,
                generation: 0
            };
            nodes.push(node);
            nodeMap.set(person.name, node);
        }
    });
    
    // Calculer les générations
    function calculateGeneration(personName, visited = new Set()) {
        if (visited.has(personName)) return 0;
        visited.add(personName);
        
        const node = nodeMap.get(personName);
        if (!node) return 0;
        
        if (node.parents.length === 0) {
            node.generation = 0;
            return 0;
        }
        
        let maxParentGeneration = -1;
        for (const parentName of node.parents) {
            const parentGeneration = calculateGeneration(parentName, new Set(visited));
            maxParentGeneration = Math.max(maxParentGeneration, parentGeneration);
        }
        
        node.generation = maxParentGeneration + 1;
        return node.generation;
    }
    
    // Calculer toutes les générations
    nodes.forEach(node => {
        if (node.generation === 0) {
            calculateGeneration(node.name);
        }
    });
    
    // Créer les liens
    const links = [];
    const linkSet = new Set(); // Pour éviter les doublons
    
    nodes.forEach(node => {
        // Liens parent → enfant
        node.parents.forEach(parentName => {
            if (nodeMap.has(parentName)) {
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
        
        // Liens conjoints (bidirectionnels, mais on n'ajoute qu'une fois)
        node.conjoints.forEach(conjointName => {
            if (nodeMap.has(conjointName) && node.name < conjointName) {
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
    
    return { nodes, links };
}

// ==========================
// Fonction pour dessiner l'arbre unifié avec positionnement par génération
// ==========================
function drawUnifiedFamilyTree(data) {
    if (!data || (!data.nodes && !data.personnes)) return;

    svg.selectAll("*").remove();
    g = svg.append("g");

    const width = svg.node().clientWidth || 1200;
    const height = svg.node().clientHeight || 800;

    // Construire la structure unifiée
    let unifiedData;
    if (data.personnes) {
        unifiedData = buildUnifiedFamilyTree(data.personnes);
    } else {
        unifiedData = data;
    }

    // Grouper par génération
    const generationGroups = {};
    const maxGeneration = Math.max(...unifiedData.nodes.map(n => n.generation));
    
    unifiedData.nodes.forEach(node => {
        const gen = node.generation;
        if (!generationGroups[gen]) {
            generationGroups[gen] = [];
        }
        generationGroups[gen].push(node);
    });

    // Positionner les nœuds par génération
    const generationHeight = height / (maxGeneration + 2);
    
    Object.keys(generationGroups).forEach(gen => {
        const genNumber = parseInt(gen);
        const nodesInGen = generationGroups[gen];
        const genWidth = width / (nodesInGen.length + 1);
        
        nodesInGen.forEach((node, index) => {
            node.x = (index + 1) * genWidth;
            node.y = (genNumber + 1) * generationHeight;
            node.fx = node.x; // Fixer la position initiale
            node.fy = node.y;
        });
    });

    // Définir les marqueurs et gradients
    const defs = svg.select("defs").empty() ? svg.append("defs") : svg.select("defs");
    
    if (svg.select("#arrowhead-unified").empty()) {
        defs.append("marker")
            .attr("id", "arrowhead-unified")
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

    if (svg.select("#femmeGradient").empty()) {
        const femmeGradient = defs.append("linearGradient")
            .attr("id", "femmeGradient")
            .attr("x1", "0%").attr("y1", "0%")
            .attr("x2", "100%").attr("y2", "100%");
        femmeGradient.append("stop").attr("offset", "0%").attr("stop-color", "#fce4ec");
        femmeGradient.append("stop").attr("offset", "100%").attr("stop-color", "#f8bbd9");

        const hommeGradient = defs.append("linearGradient")
            .attr("id", "hommeGradient")
            .attr("x1", "0%").attr("y1", "0%")
            .attr("x2", "100%").attr("y2", "100%");
        hommeGradient.append("stop").attr("offset", "0%").attr("stop-color", "#e3f2fd");
        hommeGradient.append("stop").attr("offset", "100%").attr("stop-color", "#bbdefb");
    }

    // Créer la simulation avec forces personnalisées
    const simulation = d3.forceSimulation(unifiedData.nodes)
        .force("link", d3.forceLink(unifiedData.links)
            .id(d => d.name || d.id)
            .distance(d => d.type === 'spouse' ? 200 : 150)
            .strength(0.3))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(80))
        // Force pour maintenir les générations
        .force("generation", d3.forceY(d => (d.generation + 1) * generationHeight).strength(0.8))
        .alphaDecay(0.02)
        .alphaMin(0.001);

    // Créer les liens
    const link = g.selectAll(".link")
        .data(unifiedData.links)
        .enter().append("line")
        .attr("class", d => `link ${d.type === 'spouse' ? 'spouse-link' : 'parent-link'}`)
        .attr("stroke", d => {
            switch(d.type) {
                case 'spouse': return "#e91e63";
                case 'parent': return "#2196f3";
                default: return "#666";
            }
        })
        .attr("stroke-width", d => d.type === 'spouse' ? 3 : 2)
        .attr("stroke-dasharray", d => d.type === 'spouse' ? "5,5" : "none")
        .attr("marker-end", d => d.type === 'parent' ? "url(#arrowhead-unified)" : "none")
        .attr("opacity", 0.8);

    // Créer les nœuds
    const node = g.selectAll(".node")
        .data(unifiedData.nodes)
        .enter().append("g")
        .attr("class", "node")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended))
        .on("click", (event, d) => showPersonDetails(event, d))
        .on("mouseenter", function(event, d) {
            // Highlight des connexions
            d3.selectAll(".link")
                .transition().duration(200)
                .attr("opacity", l => 
                    (l.source.name || l.source.id || l.source) === d.name || 
                    (l.target.name || l.target.id || l.target) === d.name ? 1 : 0.2
                );
            
            d3.select(this).select("rect")
                .transition().duration(200)
                .attr("stroke", "#ff6b6b")
                .attr("stroke-width", 4)
                .attr("filter", "drop-shadow(4px 4px 8px rgba(255,107,107,0.4))");
        })
        .on("mouseleave", function(event, d) {
            d3.selectAll(".link")
                .transition().duration(200)
                .attr("opacity", 0.8);
                
            d3.select(this).select("rect")
                .transition().duration(200)
                .attr("stroke", "none")
                .attr("filter", "drop-shadow(2px 2px 4px rgba(0,0,0,0.2))");
        });

    // Rectangle du nœud avec style amélioré
    node.append("rect")
        .attr("width", 160)
        .attr("height", 60)
        .attr("x", -80)
        .attr("y", -30)
        .attr("rx", 15)
        .attr("ry", 15)
        .attr("fill", d => {
            if (d.genre === "Femme") return "url(#femmeGradient)";
            if (d.genre === "Homme") return "url(#hommeGradient)";
            return "#f8f9fa";
        })
        .attr("stroke", "none")
        .attr("filter", "drop-shadow(2px 2px 4px rgba(0,0,0,0.2))");

    // Icône de genre
    node.append("text")
        .attr("x", -70)
        .attr("y", -10)
        .attr("font-size", "20px")
        .attr("font-weight", "bold")
        .attr("fill", d => d.genre === "Femme" ? "#e91e63" : "#2196f3")
        .text(d => d.genre === "Femme" ? "♀" : "♂");

    // Nom de la personne
    node.append("text")
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .attr("font-size", "13px")
        .attr("font-weight", "600")
        .attr("fill", "#333")
        .text(d => d.name.length > 20 ? d.name.substring(0, 17) + "..." : d.name)
        .call(wrapText, 150);

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

    // Animation de la simulation
    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    // Fonctions de drag
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
        // Libérer les contraintes pour permettre le mouvement naturel
        d.fx = null;
        d.fy = null;
    }
}

// ==========================
// Fonction pour construire un arbre hiérarchique sans duplications
// ==========================



function buildCleanHierarchy(persons) {
    const personMap = new Map();
    
    // Créer une map des personnes pour un accès rapide
    persons.forEach(person => {
        personMap.set(person.name, person);
    });
    
    // Identifier les racines (personnes sans parents)
    const roots = persons.filter(person => 
        !person.parents || person.parents.length === 0
    );
    
    function buildPersonNode(personName, visited = new Set()) {
        // Éviter les cycles infinis uniquement
        if (visited.has(personName)) {
            return null;
        }
        
        const person = personMap.get(personName);
        if (!person) return null;
        
        // Créer un nouveau path pour cette branche
        const newVisited = new Set([...visited, personName]);
        
        const node = {
            name: person.name,
            genre: person.genre,
            id: person.name,
            children: [],
            parents: person.parents || [], // Garder l'info des parents pour l'affichage
            conjoints: person.conjoints || []
        };
        
        // Ajouter tous les enfants (SANS empêcher leur réapparition ailleurs)
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
    
    // Construire l'arbre à partir de toutes les racines
    const hierarchy = [];
    for (const root of roots) {
        const rootNode = buildPersonNode(root.name);
        if (rootNode) {
            hierarchy.push(rootNode);
        }
    }
    
    return hierarchy;
}

// Version alternative qui suit exactement la logique Python
function buildCleanHierarchyExact(persons) {
    const personMap = new Map();
    
    // Créer une map des personnes
    persons.forEach(person => {
        personMap.set(person.name, person);
    });
    
    function buildPersonNode(personName, visited = null) {
        if (visited === null) {
            visited = new Set();
        }
        
        // Éviter les cycles uniquement
        if (visited.has(personName)) {
            return null;
        }
        
        if (!personMap.has(personName)) {
            return null;
        }
        
        const person = personMap.get(personName);
        const newPath = new Set([...visited, personName]);
        
        const node = {
            id: personName,
            name: personName,
            genre: person.genre || "Inconnu",
            children: [],
            parents: person.parents || [],
            conjoints: person.conjoints || [],
            enfants: person.enfants || []
        };
        
        // Ajouter tous les enfants (permettre les réapparitions dans d'autres branches)
        const enfants = person.enfants || [];
        for (const childName of enfants) {
            if (personMap.has(childName)) {
                const childNode = buildPersonNode(childName, newPath);
                if (childNode) {
                    node.children.push(childNode);
                }
            }
        }
        
        return node;
    }
    
    // Identifier les racines
    const roots = [];
    for (const [name, info] of personMap) {
        const parents = info.parents || [];
        if (parents.length === 0) {
            roots.push(name);
        }
    }
    
    // Construire la hiérarchie
    const hierarchy = [];
    for (const rootName of roots) {
        const rootNode = buildPersonNode(rootName);
        if (rootNode) {
            hierarchy.push(rootNode);
        }
    }
    
    return hierarchy;
}

// Fonction de visualisation adaptée pour montrer tous les parents
function drawHierarchicalTreeWithAllParents(data) {
    if (!data || data.length === 0) return;

    svg.selectAll("*").remove();
    g = svg.append("g");

    const width = svg.node().clientWidth || 1200;
    const height = svg.node().clientHeight || 800;

    // Utiliser la hiérarchie qui permet les multi-parents
    let hierarchyData = data;
    if (data.personnes) {
        hierarchyData = buildCleanHierarchyExact(data.personnes);
    }

    const rootData = { name: "Arbre Généalogique", children: hierarchyData };
    const root = d3.hierarchy(rootData);

    root.x0 = height / 2;
    root.y0 = 0;

    // Espacement adaptatif
    const nodeCount = root.descendants().length;
    const nodeSpacing = Math.max(80, Math.min(140, 1000 / Math.sqrt(nodeCount)));
    const levelSpacing = Math.max(180, Math.min(250, 1200 / root.height));
    
    const treeLayout = d3.tree().nodeSize([nodeSpacing, levelSpacing]);
    
    // Collapse initial sauf premiers niveaux
    root.descendants().forEach(d => {
        if (d.depth > 2) {
            d._children = d.children;
            d.children = null;
        }
    });
    
    update(root);

    function update(source) {
        const treeData = treeLayout(root);
        const nodes = treeData.descendants();
        const links = treeData.links();

        // Centrage
        const bounds = {
            minX: d3.min(nodes, d => d.x),
            maxX: d3.max(nodes, d => d.x),
            minY: d3.min(nodes, d => d.y),
            maxY: d3.max(nodes, d => d.y)
        };
        
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;
        
        nodes.forEach(d => {
            d.x = d.x - centerX + height / 2;
            d.y = d.y - bounds.minY + 100;
        });

        // Marqueurs
        if (svg.select("#arrowhead").empty()) {
            svg.append("defs").append("marker")
                .attr("id", "arrowhead")
                .attr("viewBox", "0 -5 10 10")
                .attr("refX", 18)
                .attr("refY", 0)
                .attr("markerWidth", 6)
                .attr("markerHeight", 6)
                .attr("orient", "auto")
                .append("path")
                .attr("d", "M0,-5L10,0L0,5")
                .attr("fill", "#666");
        }

        // Liens normaux parent-enfant
        const link = g.selectAll(".hierarchy-link")
            .data(links, d => `${d.source.data.id || d.source.data.name}-${d.target.data.id || d.target.data.name}`);

        const linkEnter = link.enter().append("path")
            .attr("class", "hierarchy-link")
            .attr("fill", "none")
            .attr("stroke", "#666")
            .attr("stroke-width", 2)
            .attr("stroke-opacity", 0.7)
            .attr("marker-end", "url(#arrowhead)")
            .attr("d", d => diagonal(source, source));

        link.merge(linkEnter)
            .transition().duration(500)
            .attr("d", d => diagonal(d.source, d.target));

        link.exit()
            .transition().duration(500)
            .attr("d", d => diagonal(source, source))
            .remove();

        // AJOUT: Liens supplémentaires pour montrer TOUS les parents
        const allPersonsWithMultipleParents = [];
        nodes.forEach(node => {
            if (node.data.parents && node.data.parents.length > 1) {
                allPersonsWithMultipleParents.push(node);
            }
        });

        // Créer des liens supplémentaires vers les autres parents
        const extraLinks = [];
        allPersonsWithMultipleParents.forEach(childNode => {
            const childData = childNode.data;
            childData.parents.forEach(parentName => {
                // Trouver le nœud parent dans l'arbre
                const parentNode = nodes.find(n => 
                    (n.data.name || n.data.id) === parentName
                );
                
                if (parentNode) {
                    // Vérifier si ce lien existe déjà dans la hiérarchie normale
                    const hierarchyLinkExists = links.some(l => 
                        (l.source.data.name || l.source.data.id) === parentName &&
                        (l.target.data.name || l.target.data.id) === (childData.name || childData.id)
                    );
                    
                    if (!hierarchyLinkExists) {
                        extraLinks.push({
                            source: parentNode,
                            target: childNode,
                            type: 'additional-parent'
                        });
                    }
                }
            });
        });

        // Dessiner les liens supplémentaires
        const extraLink = g.selectAll(".extra-parent-link")
            .data(extraLinks, d => `extra-${d.source.data.name}-${d.target.data.name}`);

        extraLink.enter().append("path")
            .attr("class", "extra-parent-link")
            .attr("fill", "none")
            .attr("stroke", "#e91e63")
            .attr("stroke-width", 2)
            .attr("stroke-opacity", 0.6)
            .attr("stroke-dasharray", "5,5")
            .attr("marker-end", "url(#arrowhead)")
            .merge(extraLink)
            .transition().duration(500)
            .attr("d", d => diagonal(d.source, d.target));

        extraLink.exit().remove();

        // Nœuds
        const node = g.selectAll(".hierarchy-node")
            .data(nodes, d => d.data.id || d.data.name);

        const nodeEnter = node.enter().append("g")
            .attr("class", "hierarchy-node")
            .attr("transform", d => `translate(${source.y0 || 0},${source.x0 || 0})`)
            .style("opacity", 0)
            .on("click", (event, d) => {
                // Toggle children
                if (d.children) {
                    d._children = d.children;
                    d.children = null;
                } else if (d._children) {
                    d.children = d._children;
                    d._children = null;
                }
                update(d);
                
                // Afficher détails avec info sur tous les parents
                showPersonDetailsWithAllParents(event, d);
            });

        // Rectangle du nœud avec indication multi-parents
        nodeEnter.append("rect")
            .attr("width", 140)
            .attr("height", d => {
                // Hauteur augmentée si plusieurs parents
                const hasMultipleParents = d.data.parents && d.data.parents.length > 1;
                return hasMultipleParents ? 65 : 55;
            })
            .attr("x", -70)
            .attr("y", d => {
                const hasMultipleParents = d.data.parents && d.data.parents.length > 1;
                return hasMultipleParents ? -32.5 : -27.5;
            })
            .attr("rx", 12)
            .attr("ry", 12)
            .attr("fill", d => {
                const baseColor = getNodeColor(d);
                const hasMultipleParents = d.data.parents && d.data.parents.length > 1;
                return hasMultipleParents ? "#fff3e0" : baseColor; // Couleur spéciale pour multi-parents
            })
            .attr("stroke", d => {
                const hasMultipleParents = d.data.parents && d.data.parents.length > 1;
                return hasMultipleParents ? "#ff9800" : "none";
            })
            .attr("stroke-width", d => {
                const hasMultipleParents = d.data.parents && d.data.parents.length > 1;
                return hasMultipleParents ? 2 : 0;
            })
            .attr("filter", "drop-shadow(2px 2px 3px rgba(0,0,0,0.2))");

        // Indicateur multi-parents
        nodeEnter.append("circle")
            .attr("r", d => {
                const hasMultipleParents = d.data.parents && d.data.parents.length > 1;
                return hasMultipleParents ? 8 : 0;
            })
            .attr("cx", -55)
            .attr("cy", d => {
                const hasMultipleParents = d.data.parents && d.data.parents.length > 1;
                return hasMultipleParents ? -20 : 0;
            })
            .attr("fill", "#ff9800")
            .attr("opacity", d => d.data.parents && d.data.parents.length > 1 ? 1 : 0);

        nodeEnter.append("text")
            .attr("x", -55)
            .attr("y", d => {
                const hasMultipleParents = d.data.parents && d.data.parents.length > 1;
                return hasMultipleParents ? -20 : 0;
            })
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .attr("font-size", "10px")
            .attr("font-weight", "bold")
            .attr("fill", "white")
            .attr("opacity", d => d.data.parents && d.data.parents.length > 1 ? 1 : 0)
            .text(d => d.data.parents && d.data.parents.length > 1 ? d.data.parents.length : "");

        // Nom et autres éléments comme avant...
        nodeEnter.append("text")
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .attr("font-size", "13px")
            .attr("font-weight", "600")
            .attr("fill", "#333")
            .text(d => d.data.name)
            .call(wrapText, 130);

        // Reste des animations...
        const nodeUpdate = node.merge(nodeEnter)
            .transition().duration(500)
            .attr("transform", d => `translate(${d.y},${d.x})`)
            .style("opacity", 1);

        const nodeExit = node.exit()
            .transition().duration(500)
            .attr("transform", d => `translate(${source.y},${source.x})`)
            .style("opacity", 0)
            .remove();

        nodes.forEach(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }

    function diagonal(s, d) {
        return `M${s.y},${s.x}C${(s.y + d.y) / 2},${s.x} ${(s.y + d.y) / 2},${d.x} ${d.y},${d.x}`;
    }
}

function showPersonDetailsWithAllParents(event, node) {
    const person = node.data;
    const details = document.getElementById('person-details') || createDetailsElement();
    
    let parentsText = 'Aucun parent';
    if (person.parents && person.parents.length > 0) {
        parentsText = person.parents.join(', ');
        if (person.parents.length > 1) {
            parentsText += ` (${person.parents.length} parents)`;
        }
    }
    
    const childrenText = person.enfants && person.enfants.length > 0 ? 
        person.enfants.join(', ') : 'Aucun enfant';
    const spousesText = person.conjoints && person.conjoints.length > 0 ? 
        person.conjoints.join(', ') : 'Aucun conjoint';
        
    details.innerHTML = `
        <h3>${person.genre === "Femme" ? "♀" : "♂"} ${person.name}</h3>
        <p><strong>Genre:</strong> ${person.genre}</p>
        <p><strong>Parents:</strong> ${parentsText}</p>
        <p><strong>Enfants:</strong> ${childrenText}</p>
        <p><strong>Conjoints:</strong> ${spousesText}</p>
        <button onclick="this.parentElement.style.display='none'">Fermer</button>
    `;
    
    details.style.left = (event.pageX + 10) + 'px';
    details.style.top = (event.pageY + 10) + 'px';
    details.style.display = 'block';
}

function createDetailsElement() {
    const details = document.createElement('div');
    details.id = 'person-details';
    details.style.cssText = `
        position: absolute;
        background: white;
        border: 2px solid #3498db;
        border-radius: 10px;
        padding: 15px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        max-width: 300px;
        z-index: 1001;
        display: none;
    `;
    document.body.appendChild(details);
    return details;
}


// ==========================
// Version améliorée de drawHierarchicalTree
// ==========================
function drawHierarchicalTree(data) {
    if (!data || data.length === 0) return;

    svg.selectAll("*").remove();
    g = svg.append("g");

    const width = svg.node().clientWidth || 1200;
    const height = svg.node().clientHeight || 800;

    // Si les données viennent du serveur avec structure différente
    let hierarchyData = data;
    if (data.personnes) {
        hierarchyData = buildCleanHierarchy(data.personnes);
    }

    const rootData = { name: "Arbre Généalogique", children: hierarchyData };
    const root = d3.hierarchy(rootData);

    root.x0 = height / 2;
    root.y0 = 0;

    // Ajustement dynamique de l'espacement selon la taille de l'arbre
    const nodeCount = root.descendants().length;
    const nodeSpacing = Math.max(80, Math.min(140, 1000 / Math.sqrt(nodeCount)));
    const levelSpacing = Math.max(180, Math.min(250, 1200 / root.height));
    
    const treeLayout = d3.tree().nodeSize([nodeSpacing, levelSpacing]);
    
    // Collapse tous les nœuds initialement sauf les 2 premiers niveaux
    root.descendants().forEach(d => {
        if (d.depth > 2) {
            d._children = d.children;
            d.children = null;
        }
    });
    
    update(root);

    function update(source) {
        const treeData = treeLayout(root);
        const nodes = treeData.descendants();
        const links = treeData.links();

        // Ajuster la vue pour centrer l'arbre
        const bounds = {
            minX: d3.min(nodes, d => d.x),
            maxX: d3.max(nodes, d => d.x),
            minY: d3.min(nodes, d => d.y),
            maxY: d3.max(nodes, d => d.y)
        };
        
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;
        
        // Ajuster les positions pour centrer
        nodes.forEach(d => {
            d.x = d.x - centerX + height / 2;
            d.y = d.y - bounds.minY + 100;
        });

        // --- Marqueurs de flèches ---
        if (svg.select("#arrowhead").empty()) {
            svg.append("defs").append("marker")
                .attr("id", "arrowhead")
                .attr("viewBox", "0 -5 10 10")
                .attr("refX", 18)
                .attr("refY", 0)
                .attr("markerWidth", 6)
                .attr("markerHeight", 6)
                .attr("orient", "auto")
                .append("path")
                .attr("d", "M0,-5L10,0L0,5")
                .attr("fill", "#666");
        }

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

        link.exit()
            .transition().duration(500)
            .attr("d", d => diagonal(source, source))
            .remove();

        // --- Noeuds ---
        const node = g.selectAll(".node")
            .data(nodes, d => d.data.id || d.data.name);

        const nodeEnter = node.enter().append("g")
            .attr("class", "node")
            .attr("transform", d => `translate(${source.y0 || 0},${source.x0 || 0})`)
            .style("opacity", 0)
            .on("click", (event, d) => {
                // Toggle children
                if (d.children) {
                    d._children = d.children;
                    d.children = null;
                } else if (d._children) {
                    d.children = d._children;
                    d._children = null;
                }
                update(d);
                
                // Afficher détails
                showPersonDetails(event, d);
            })
            .on("mouseenter", function(event, d) {
                d3.select(this).select("rect")
                    .transition().duration(200)
                    .attr("stroke", "#ff6b6b")
                    .attr("stroke-width", 3)
                    .attr("filter", "drop-shadow(3px 3px 5px rgba(255,107,107,0.3))");
            })
            .on("mouseleave", function(event, d) {
                d3.select(this).select("rect")
                    .transition().duration(200)
                    .attr("stroke", "none")
                    .attr("filter", "drop-shadow(2px 2px 3px rgba(0,0,0,0.2))");
            });

        // Rectangle du nœud
        nodeEnter.append("rect")
            .attr("width", 140)
            .attr("height", 55)
            .attr("x", -70)
            .attr("y", -27.5)
            .attr("rx", 12)
            .attr("ry", 12)
            .attr("fill", d => getNodeColor(d))
            .attr("stroke", "none")
            .attr("filter", "drop-shadow(2px 2px 3px rgba(0,0,0,0.2))");

        // Indicateur de genre
        nodeEnter.append("text")
            .attr("x", -65)
            .attr("y", -12)
            .attr("font-size", "18px")
            .attr("font-weight", "bold")
            .attr("fill", d => d.data.genre === "Femme" ? "#ff69b4" : "#4169e1")
            .text(d => d.data.genre === "Femme" ? "♀" : "♂");

        // Nom de la personne
        nodeEnter.append("text")
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .attr("font-size", "13px")
            .attr("font-weight", "600")
            .attr("fill", "#333")
            .text(d => d.data.name)
            .call(wrapText, 130);

        // Indicateur d'enfants cachés
        nodeEnter.append("circle")
            .attr("r", 8)
            .attr("cx", 60)
            .attr("cy", 0)
            .attr("fill", d => d._children ? "#4CAF50" : "none")
            .attr("stroke", d => d._children ? "#2E7D32" : "none")
            .attr("stroke-width", 2)
            .style("cursor", "pointer");

        nodeEnter.append("text")
            .attr("x", 60)
            .attr("y", 0)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .attr("font-size", "12px")
            .attr("font-weight", "bold")
            .attr("fill", "white")
            .text(d => d._children ? "+" : "")
            .style("cursor", "pointer");

        // Animations d'entrée
        const nodeUpdate = node.merge(nodeEnter)
            .transition().duration(500)
            .attr("transform", d => `translate(${d.y},${d.x})`)
            .style("opacity", 1);

        // Mise à jour des indicateurs
        nodeUpdate.select("circle")
            .attr("fill", d => d._children ? "#4CAF50" : "none")
            .attr("stroke", d => d._children ? "#2E7D32" : "none");

        nodeUpdate.select("text:last-child")
            .text(d => d._children ? "+" : "");

        // Animation de sortie
        const nodeExit = node.exit()
            .transition().duration(500)
            .attr("transform", d => `translate(${source.y},${source.x})`)
            .style("opacity", 0)
            .remove();

        // Sauvegarder les positions
        nodes.forEach(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }

    function diagonal(s, d) {
        const path = `M${s.y},${s.x}
                     C${(s.y + d.y) / 2},${s.x}
                      ${(s.y + d.y) / 2},${d.x}
                      ${d.y},${d.x}`;
        return path;
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
