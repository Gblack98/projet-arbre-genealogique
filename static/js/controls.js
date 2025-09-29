// ==========================
// Contrôles UI
// ==========================
export function setupControls() {
    document.getElementById("show-hierarchical").addEventListener("click", () => {
        document.getElementById("tree-type").value = "hierarchical";
    });
    document.getElementById("show-force").addEventListener("click", () => {
        document.getElementById("tree-type").value = "force";
    });
}
