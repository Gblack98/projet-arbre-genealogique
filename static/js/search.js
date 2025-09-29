// ==========================
// Search & Suggestions
// ==========================
export function setupSearch(nodes) {
    const input = document.getElementById("search-input");
    const list = document.getElementById("search-suggestions");

    input.addEventListener("input", () => {
        const query = input.value.toLowerCase();
        const matches = nodes.filter(n => n.name.toLowerCase().includes(query));
        list.innerHTML = "";
        matches.slice(0, 5).forEach(m => {
            const li = document.createElement("li");
            li.textContent = m.name;
            li.onclick = () => {
                input.value = m.name;
                list.innerHTML = "";
                import('./info-panel.js').then(mod => mod.showPersonDetails(null, m));
            };
            list.appendChild(li);
        });
    });
}
