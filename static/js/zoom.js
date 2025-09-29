// ==========================
// Initialisation SVG & Zoom
// ==========================
export function setupZoom(svg, g) {
    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => g.attr("transform", event.transform));

    svg.call(zoom);

    document.getElementById("zoom-in").addEventListener("click", () => svg.transition().duration(300).call(zoom.scaleBy, 1.3));
    document.getElementById("zoom-out").addEventListener("click", () => svg.transition().duration(300).call(zoom.scaleBy, 0.7));
    document.getElementById("reset-view").addEventListener("click", () => svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity));
}
