/* js/history-bridge.js */
const HistoryBridge = {
    lastYear: null,
    cache: {}, // Simple cache to prevent re-fetching the same year

    async update(currentYear) {
        const year = Math.floor(currentYear);
        if (year === this.lastYear) return;
        this.lastYear = year;

        // Show a loading state in your HUD
        this.updateHUD(`Scanning records for ${year}...`, true);

        // Fetch from Wikipedia (via the 'On This Day' endpoint for the current year)
        // Note: For deep history, we use the 'year' search.
        try {
            const events = await this.fetchEvents(year);
            this.renderEvents(events, year);
        } catch (err) {
            this.updateHUD(`No historical records found for ${year}.`);
        }
    },

    async fetchEvents(year) {
        if (this.cache[year]) return this.cache[year];

        // Option A: Wikipedia REST API (Events for this year)
        // We use a query for the specific year page
        const url = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&titles=${year}&format=json&origin=*`;
        
        const response = await fetch(url);
        const data = await response.json();
        const pages = data.query.pages;
        const pageId = Object.keys(pages)[0];
        const content = pages[pageId].extract || "No detailed records available.";

        this.cache[year] = content;
        return content;
    },

    updateHUD(text, isLoading = false) {
        const hud = document.getElementById("historyContent");
        if (hud) {
            hud.innerHTML = text;
            hud.style.opacity = isLoading ? 0.5 : 1;
        }
    },

    renderEvents(html, year) {
        const hud = document.getElementById("historyContent");
        if (!hud) return;
        
        // Strip out excess HTML but keep structure
        hud.innerHTML = `<h3>History of ${year}</h3>` + html;
    }
};