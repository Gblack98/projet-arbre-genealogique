import { drawHierarchicalTree } from './tree-hierarchical.js';
import { drawForceTree } from './tree-force.js';
import { closePanel } from './ui.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

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

// ==========================
// Contrôles de l'interface
// ==========================

// Contrôles de zoom
document.getElementById("zoom-in").addEventListener("click", () => svg.transition().duration(300).call(zoom.scaleBy, 1.3));
document.getElementById("zoom-out").addEventListener("click", () => svg.transition().duration(300).call(zoom.scaleBy, 0.7));
document.getElementById("reset-view").addEventListener("click", () => svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity));

// Gestion des boutons de vue
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
// Fonction de chargement et de dessin
// ==========================
export function fetchAndDraw(url, drawFn) {
    // Supprime le contenu existant avant de charger les nouvelles données
    svg.selectAll("*").remove();
    g = svg.append("g");
    
    fetch(url)
        .then(res => {
            if (!res.ok) throw new Error(`Erreur HTTP: ${res.status}`);
            return res.json();
        })
        .then(data => {
            closePanel();
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

// ==========================
// Chargement initial
// ==========================
window.addEventListener("load", () => {
    fetchAndDraw("/api/hierarchical-tree", drawHierarchicalTree);
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
