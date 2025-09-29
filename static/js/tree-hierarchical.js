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

