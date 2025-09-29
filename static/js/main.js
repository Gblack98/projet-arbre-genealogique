import { setupZoom } from './zoom.js';
import { drawHierarchicalTree } from './tree-hierarchical.js';
import { drawForceTree } from './tree-force.js';
import { setupControls } from './controls.js';
import { setupSearch } from './search.js';
import { setupRelationModal } from './relation-modal.js';

// Initialisation SVG et Zoom
const svg = d3.select("#tree-svg");
const g = svg.append("g");
setupZoom(svg, g);

// Chargement des données (exemple : nodes + links)
fetch('data/nodes.json').then(res => res.json()).then(nodesData => {
    fetch('data/links.json').then(res => res.json()).then(linksData => {
        const treeType = document.getElementById("tree-type").value;
        if (treeType === "hierarchical") drawHierarchicalTree(nodesData);
        else drawForceTree({ nodes: nodesData, links: linksData });
        setupSearch(nodesData);
    });
});

setupControls();
setupRelationModal();
