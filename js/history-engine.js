const HistoryEngine = {
    lastYearFetched: null,
    
    async update(year) {
        const roundedYear = Math.floor(year);
        if (roundedYear === this.lastYearFetched) return;
        this.lastYearFetched = roundedYear;

        // Wikipedia API for "Events in Year X"
        const url = `https://en.wikipedia.org/api/rest_v1/feed/onthisday/all/${this.getTodayDate()}`;
        
        try {
            // Note: For specific historical years, a better API is 
            // the Wikipedia "Selected Anniversaries" or "Query" API
            // For now, let's log the transition
            console.log(`Searching history for year: ${roundedYear}`);
            this.displayEvent(`In ${roundedYear}, the "vibe" was shifting...`);
        } catch (e) {
            console.error("History fetch failed", e);
        }
    },

    getTodayDate() {
        const now = new Date();
        return `${String(now.getUTCMonth() + 1).padStart(2, '0')}/${String(now.getUTCDate()).padStart(2, '0')}`;
    },

    displayEvent(text) {
        // You could create a floating div in your HTML for this
        let el = document.getElementById("historyOverlay");
        if (!el) {
            el = document.createElement("div");
            el.id = "historyOverlay";
            el.style = "position:fixed; bottom:100px; right:20px; width:250px; background:rgba(0,0,0,0.7); padding:15px; border-radius:10px; font-size:12px; border:1px solid gold; z-index:1000; pointer-events:none; transition: opacity 0.5s;";
            document.body.appendChild(el);
        }
        el.textContent = text;
    }
};