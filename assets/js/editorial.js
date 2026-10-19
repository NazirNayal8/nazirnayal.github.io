/* Progressive enhancement: all content remains visible without JavaScript. */
(() => {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const navbar = document.getElementById("navbar");
  const updateNavbar = () => {
    if (navbar) navbar.classList.toggle("is-scrolled", window.scrollY > 12);
  };
  updateNavbar();
  window.addEventListener("scroll", updateNavbar, { passive: true });

  // Grain for the denoising reveal: a small tile of ink and accent speckles in the current theme.
  const paintGrain = () => {
    const size = 180;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const style = getComputedStyle(document.documentElement);
    const toRgb = (value) => {
      ctx.fillStyle = "#000";
      ctx.fillStyle = value;
      const hex = ctx.fillStyle;
      return hex.charAt(0) === "#" ? [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) : [0, 0, 0];
    };
    const ink = toRgb(style.getPropertyValue("--global-text-color").trim() || "#23332e");
    const accent = toRgb(style.getPropertyValue("--global-theme-color").trim() || "#087f83");
    const image = ctx.createImageData(size, size);
    for (let i = 0; i < image.data.length; i += 4) {
      const roll = Math.random();
      if (roll > 0.5) continue;
      const rgb = roll < 0.16 ? accent : ink;
      const strength = Math.sqrt(-2 * Math.log(Math.random() || 1e-6));
      image.data[i] = rgb[0];
      image.data[i + 1] = rgb[1];
      image.data[i + 2] = rgb[2];
      image.data[i + 3] = Math.min(255, 105 * strength);
    }
    ctx.putImageData(image, 0, 0);
    document.documentElement.style.setProperty("--denoise-grain", `url(${canvas.toDataURL("image/png")})`);
  };

  // Only elements below the initial viewport are eligible for scroll reveals.
  if (!reducedMotion.matches && "IntersectionObserver" in window) {
    paintGrain();
    new MutationObserver(paintGrain).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll(".home-section, ol.bibliography > li, .project-step, .post-list > li, .cv > .card").forEach((element) => {
      if (element.getBoundingClientRect().top < window.innerHeight) return;
      // Nested items (papers inside a home section) denoise with their section, not twice.
      if (element.parentElement && element.parentElement.closest(".reveal-ready")) return;
      element.classList.add("reveal-ready");
      revealObserver.observe(element);
    });
  }

  // Keyboard support for the existing abstract / BibTeX / award controls.
  document.querySelectorAll(".publications .links a.abstract, .publications .links a.bibtex, .publications .links a.award").forEach((control) => {
    control.setAttribute("role", "button");
    control.setAttribute("tabindex", "0");
    control.setAttribute("aria-expanded", "false");
    control.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        control.click();
      }
    });
  });
  document.querySelectorAll("ol.bibliography > li").forEach((entry) => {
    if (!("MutationObserver" in window)) return;
    const observer = new MutationObserver(() => {
      ["abstract", "bibtex", "award"].forEach((kind) => {
        const control = entry.querySelector(`.links a.${kind}`);
        const panel = entry.querySelector(`div.${kind}.hidden`);
        if (control && panel) control.setAttribute("aria-expanded", String(panel.classList.contains("open")));
      });
    });
    entry.querySelectorAll(".hidden").forEach((panel) => observer.observe(panel, { attributes: true, attributeFilter: ["class"] }));
  });

  // Publication preview videos load near the viewport and play only without reduced motion.
  const videos = document.querySelectorAll("video[data-lazy-video]");
  const loadVideo = (video) => {
    const sources = video.querySelectorAll("source[data-src]");
    if (!sources.length) return;
    sources.forEach((source) => {
      source.src = source.dataset.src;
      source.removeAttribute("data-src");
    });
    video.load();
  };
  const playVideo = (video) => {
    if (reducedMotion.matches) return;
    const playing = video.play();
    if (playing && playing.catch) playing.catch(() => {});
  };
  if (videos.length && "IntersectionObserver" in window) {
    const videoObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Under reduced motion the poster frame is enough; the video is never fetched.
          if (reducedMotion.matches) return;
          loadVideo(entry.target);
          playVideo(entry.target);
        } else {
          entry.target.pause();
        }
      });
    }, { rootMargin: "200px 0px" });
    videos.forEach((video) => videoObserver.observe(video));
  } else {
    videos.forEach((video) => {
      if (reducedMotion.matches) return;
      loadVideo(video);
      playVideo(video);
    });
  }

  // Cards and images lean toward the pointer in 3D: fine pointers only, never with reduced motion.
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  if (finePointer.matches && !reducedMotion.matches) {
    document.querySelectorAll(".profile-photo, .affiliation-logo, .publications .abbr figure, .project-thumb").forEach((card) => {
      card.classList.add("is-tiltable");
      card.addEventListener("pointermove", (event) => {
        const box = card.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width - 0.5;
        const y = (event.clientY - box.top) / box.height - 0.5;
        card.classList.add("is-tilting");
        card.style.setProperty("--tilt-x", `${(-y * 9).toFixed(2)}deg`);
        card.style.setProperty("--tilt-y", `${(x * 11).toFixed(2)}deg`);
      });
      card.addEventListener("pointerleave", () => {
        card.classList.remove("is-tilting");
        card.style.setProperty("--tilt-x", "0deg");
        card.style.setProperty("--tilt-y", "0deg");
      });
    });
  }

  // Project timelines fill like a trajectory as the reader scrolls past each step.
  const timelines = document.querySelectorAll("[data-project-timeline]");
  if (timelines.length) {
    let queued = false;
    const updateTimelines = () => {
      queued = false;
      const focus = window.innerHeight * 0.6;
      // At the bottom of the page the last steps can never reach the focus line.
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      timelines.forEach((timeline) => {
        const box = timeline.getBoundingClientRect();
        const filled = atEnd ? 1 : Math.min(Math.max((focus - box.top) / Math.max(box.height, 1), 0), 1);
        timeline.style.setProperty("--timeline-progress", filled.toFixed(4));
        timeline.querySelectorAll("[data-project-step]").forEach((step) => {
          const node = step.querySelector(".project-node");
          const top = (node || step).getBoundingClientRect().top;
          step.classList.toggle("is-reached", atEnd || top < focus);
        });
      });
    };
    const queueTimelines = () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(updateTimelines);
    };
    window.addEventListener("scroll", queueTimelines, { passive: true });
    window.addEventListener("resize", queueTimelines);
    updateTimelines();
  }
})();
