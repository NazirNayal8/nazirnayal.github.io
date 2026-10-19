(() => {
  "use strict";
  const cv = document.querySelector("[data-cv]");
  if (!cv) return;
  const sections = Array.from(cv.querySelectorAll(".cv-section"));
  const controls = cv.querySelector(".cv-controls");
  const search = cv.querySelector("#cv-search");
  const status = cv.querySelector(".cv-search-status");
  const empty = cv.querySelector(".cv-no-results");
  const normalize = text => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  let savedOpenState = null;

  controls.hidden = false;
  search.addEventListener("input", () => {
    const query = normalize(search.value.trim());
    if (query && savedOpenState === null) savedOpenState = sections.map(section => section.open);
    let count = 0;
    sections.forEach((section, index) => {
      const headingMatches = query && normalize(section.querySelector("h2").textContent).includes(query);
      let matches = 0;
      section.querySelectorAll("[data-cv-item]").forEach(item => {
        item.hidden = Boolean(query) && !headingMatches && !normalize(item.textContent).includes(query);
        if (!item.hidden) matches += 1;
      });
      section.hidden = matches === 0;
      if (query && matches) section.open = true;
      if (!query && savedOpenState !== null) section.open = savedOpenState[index];
      const link = cv.querySelector(`.cv-section-nav a[href="#${section.id}"]`);
      if (link) link.hidden = section.hidden;
      count += matches;
    });
    if (!query) savedOpenState = null;
    empty.hidden = count > 0;
    status.textContent = query ? `${count} matching CV ${count === 1 ? "entry" : "entries"}.` : "All CV entries shown.";
  });

  cv.querySelector("[data-cv-expand]").addEventListener("click", () => {
    sections.forEach(section => { if (!section.hidden) section.open = true; });
  });
  cv.querySelector("[data-cv-collapse]").addEventListener("click", () => {
    sections.forEach(section => { section.open = false; });
  });
  cv.querySelectorAll(".cv-section-nav a").forEach(link => {
    link.addEventListener("click", () => {
      const target = document.getElementById(link.hash.slice(1));
      if (target) target.open = true;
    });
  });
})();
