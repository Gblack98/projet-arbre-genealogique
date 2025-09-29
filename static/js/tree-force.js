import { getNodeColor, wrapText } from './node-utils.js';

export function drawForceTree(data) {
    if (!data || !data.nodes || !data.links) return;

    const svg = d3.select("#tree-svg");
    svg.selectAll("*").remove();
    const g = svg.append("g");

    const width = svg.node().clientWidth || 1200;
    const height = svg.node().clientHeight || 800;

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

    const simulation = d3.forceSimulation(data.nodes)
        .force("link", d3.forceLink(data.links).id(d => d.name).distance(150).strength(0.5))
        .force("charge", d3.forceManyBody().strength(-400))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(75))
        .alphaDecay(0.05)
        .alphaMin(0.01);

    const link = g.selectAll(".link")
        .data(data.links)
        .enter().append("line")
        .attr("class", d => `link ${d.type === 'spouse' ? 'spouse-link' : 'parent-link'}`)
        .attr("stroke", d => d.type === 'spouse' ? "#ff6b9d" : "#666")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", d => d.type === 'spouse' ? "5,5" : "none")
        .attr("marker-end", d => d.type === 'parent' ? "url(#arrowhead-force)" : "none");

    const node = g.selectAll(".node")
        .data(data.nodes)
        .enter().append("g")
        .attr("class", "node")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended))
        .on("click", (event, d) => import('./info-panel.js').then(mod => mod.showPersonDetails(event, d)))
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
        .text(d => d.name.length > 0 ? d.name : "")
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
        d.fx = d.x; d.fy = d.y;
    }

    function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
    }
}
