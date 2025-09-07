Family Tree Visualization

This project demonstrates a family tree visualization using D3.js. The code has been refactored into a modular structure for better organization and maintainability.
File Structure

    static/js/core.js: Contains the main application logic, including D3.js initialization, zoom functionality, and the primary data fetching and drawing function (fetchAndDraw). It acts as the central orchestrator.

    static/js/tree-hierarchical.js: Implements the logic for the hierarchical tree layout. It is responsible for drawing nodes and links in this specific view.

    static/js/tree-force.js: Implements the logic for the force-directed graph layout. This view is used for showing ancestors, descendants, or the full tree.

    static/js/utils.js: A collection of reusable helper functions, such as those for coloring nodes, wrapping text, and formatting lists.

    static/js/ui.js: Manages all user interface interactions, including the info panel, search functionality, and event listeners for UI elements.

    index.html: The main HTML file that provides the structure of the application and imports all the necessary JavaScript modules.

How to Use

    Make sure you have an API that serves the data at the following endpoints:

        /api/hierarchical-tree

        /api/tree

        /api/descendants/:name

        /api/ancestors/:name

        /api/search?q=:query

        /api/person/:id

    Open index.html in your browser.