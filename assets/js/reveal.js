/* Scroll reveals as denoising. Boxes, borders, rules and backgrounds stay still; only the content is
 * sampled from noise as it scrolls into view.
 *
 * Text uses discrete diffusion: each letter or digit starts as a random character ("uniform" noise)
 * or a mask token ("mask"), and resolves to the real character at its own step on a cosine schedule,
 * like the reverse process of a discrete diffusion model. Unresolved characters resample every step.
 * The page's own text is never modified: its glyphs are made transparent, and an overlay draws each
 * character at the exact position the browser laid it out (measured per character), so resolved
 * characters coincide with the real ones and the hand-off at the end is invisible. Search, selection,
 * links and screen readers keep working on the real text throughout.
 *
 * Images clear from blur and colour noise in the same number of steps, clipped to their own box.
 * Without JavaScript, or with reduced motion, content is shown as is. */
(() => {
  "use strict";

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;

  // Each unit reveals on its own, so items further down a long section are not done before they are seen.
  const UNITS = [
    ".about-copy > *",
    ".home-section > .section-heading",
    ".affiliation-list > li",
    ".news tr",
    "ol.bibliography > li",
    "h2.bibliography",
    ".projects h2.category",
    ".project-step",
    ".post-list > li",
    ".cv-entry",
    ".cv-item-list > li",
  ].join(", ");
  const STEPS = 14;
  const STEP_MS = 70;
  const STAGGER_MS = 90;
  const MODE = document.documentElement.dataset.textNoise === "mask" ? "mask" : "uniform";
  const LOWER = "abcdefghijklmnopqrstuvwxyz";
  const UPPER = LOWER.toUpperCase();
  const DIGITS = "0123456789";
  const MASK_TOKEN = "_";
  const SKIP = "script, style, noscript, textarea, code, pre, svg, i, .hidden, [aria-hidden='true'], mjx-container";
  const LETTER = /\p{L}/u;
  const NUMBER = /\p{N}/u;
  const SPACE = /\s/;

  const pick = (alphabet) => alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  // Noise is drawn from characters of similar width in the same font, so a noisy line keeps the
  // rhythm of the real one (a narrow "i" is not replaced by a wide "W").
  const measure = document.createElement("canvas").getContext("2d");
  const widths = new Map();
  const pools = new Map();
  const poolFor = (font, ch, kind) => {
    const key = `${font}|${ch}`;
    if (pools.has(key)) return pools.get(key);
    if (!widths.has(font)) {
      measure.font = font;
      const table = {};
      (LOWER + UPPER + DIGITS).split("").forEach((c) => {
        table[c] = measure.measureText(c).width;
      });
      widths.set(font, table);
    }
    const table = widths.get(font);
    measure.font = font;
    const target = measure.measureText(ch).width;
    const alphabet = kind === 2 ? DIGITS : kind === 1 ? UPPER : LOWER;
    const near = alphabet.split("").filter((c) => Math.abs(table[c] - target) <= Math.max(1, target * 0.22)).join("");
    const pool = near.length >= 3 ? near : alphabet;
    pools.set(key, pool);
    return pool;
  };
  const noiseFor = (g) => (MODE === "mask" ? MASK_TOKEN : pick(g.pool));
  // Cosine schedule: the fraction of resolved characters after step k is 1 - cos(pi k / 2K).
  const revealStep = () => Math.max(1, Math.ceil(((2 * STEPS) / Math.PI) * Math.acos(1 - Math.random())));

  // A tile of RGB Gaussian noise, shared by all image overlays.
  let noiseTile = null;
  const tile = () => {
    if (noiseTile) return noiseTile;
    const size = 96;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const image = ctx.createImageData(size, size);
    const gauss = () => Math.sqrt(-2 * Math.log(Math.random() || 1e-6)) * Math.cos(2 * Math.PI * Math.random());
    for (let i = 0; i < image.data.length; i += 4) {
      image.data[i] = 128 + 64 * gauss();
      image.data[i + 1] = 128 + 64 * gauss();
      image.data[i + 2] = 128 + 64 * gauss();
      image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    noiseTile = `url(${canvas.toDataURL("image/png")})`;
    return noiseTile;
  };

  // Overlays live in a positioned host that moves with the unit. Table rows cannot hold extra
  // elements, so their overlay goes in the row's last cell.
  const hostFor = (unit) => (unit.tagName === "TR" ? unit.lastElementChild || unit : unit);

  // One glyph per visible non-space character, with the font and colour of its own element.
  const prepareText = (unit, layer) => {
    const nodes = [];
    const walker = document.createTreeWalker(unit, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!node.nodeValue.trim() || !parent || parent.closest(SKIP)) return NodeFilter.FILTER_REJECT;
        if (!parent.getClientRects().length) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const styles = new Map();
    const glyphs = [];
    nodes.forEach((node) => {
      const parent = node.parentElement;
      if (!styles.has(parent)) {
        const cs = getComputedStyle(parent);
        const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        styles.set(parent, { font, css: [
          `font-family:${cs.fontFamily}`,
          `font-size:${cs.fontSize}`,
          `font-weight:${cs.fontWeight}`,
          `font-style:${cs.fontStyle}`,
          `font-stretch:${cs.fontStretch}`,
          `font-variant-caps:${cs.fontVariantCaps}`,
          `font-feature-settings:${cs.fontFeatureSettings}`,
          `text-transform:${cs.textTransform}`,
          `color:${cs.color}`,
        ].join(";") });
      }
      const { font, css } = styles.get(parent);
      const text = node.nodeValue;
      for (let i = 0; i < text.length; ) {
        const code = text.codePointAt(i);
        const ch = String.fromCodePoint(code);
        const start = i;
        i += ch.length;
        if (SPACE.test(ch)) continue;
        const kind = NUMBER.test(ch) ? 2 : LETTER.test(ch) ? (ch !== ch.toLowerCase() ? 1 : 0) : -1;
        const glyph = document.createElement("span");
        glyph.className = "dd-g";
        glyph.style.cssText = css;
        const g = { glyph, node, start, end: i, ch, kind, at: kind < 0 ? 0 : revealStep(), pool: kind < 0 ? "" : poolFor(font, ch, kind) };
        glyph.textContent = kind < 0 ? ch : noiseFor(g);
        if (kind >= 0) glyph.classList.add("is-noise");
        layer.appendChild(glyph);
        glyphs.push(g);
      }
    });
    return glyphs;
  };

  // Position every glyph on its character's measured box, relative to the host.
  const range = document.createRange();
  const placeText = (host, glyphs) => {
    const origin = host.getBoundingClientRect();
    const dx = origin.left + host.clientLeft;
    const dy = origin.top + host.clientTop;
    glyphs.forEach((g) => {
      range.setStart(g.node, g.start);
      range.setEnd(g.node, g.end);
      const box = range.getBoundingClientRect();
      const s = g.glyph.style;
      s.left = `${box.left - dx}px`;
      s.top = `${box.top - dy}px`;
      s.width = `${box.width}px`;
      s.height = `${box.height}px`;
    });
  };

  const prepareImages = (unit, host) => {
    const media = Array.from(unit.querySelectorAll("img, video")).filter((el) => {
      const box = el.getBoundingClientRect();
      return box.width >= 24 && box.height >= 24;
    });
    return media.map((el) => {
      el.classList.add("dd-media");
      // Keep the blur inside the image's own (rounded) box.
      const radius = getComputedStyle(el).borderRadius;
      el.style.clipPath = `inset(0 round ${radius})`;
      const overlay = document.createElement("span");
      overlay.className = "dd-noise";
      overlay.style.backgroundImage = tile();
      overlay.style.borderRadius = radius;
      host.appendChild(overlay);
      return { el, overlay };
    });
  };
  const placeImages = (host, images) => {
    const origin = host.getBoundingClientRect();
    images.forEach(({ el, overlay }) => {
      const box = el.getBoundingClientRect();
      Object.assign(overlay.style, {
        left: `${box.left - origin.left - host.clientLeft}px`,
        top: `${box.top - origin.top - host.clientTop}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
      });
    });
  };
  const noiseImages = (images, sigma) => {
    images.forEach(({ el, overlay }) => {
      el.style.setProperty("--dd-blur", `${(10 * sigma).toFixed(2)}px`);
      overlay.style.opacity = (0.9 * sigma).toFixed(3);
      overlay.style.backgroundPosition = `${Math.floor(Math.random() * 96)}px ${Math.floor(Math.random() * 96)}px`;
    });
  };

  const prepared = new Map();
  const place = (state) => {
    placeText(state.host, state.glyphs);
    placeImages(state.host, state.images);
  };
  const prepare = (unit) => {
    if (prepared.has(unit)) return prepared.get(unit);
    const host = hostFor(unit);
    const layer = document.createElement("span");
    layer.className = "dd-layer";
    layer.setAttribute("aria-hidden", "true");
    const glyphs = prepareText(unit, layer);
    host.classList.add("dd-host");
    host.appendChild(layer);
    unit.classList.add("dd-unit");
    const state = { unit, host, layer, glyphs, images: prepareImages(unit, host) };
    place(state);
    noiseImages(state.images, 1);
    prepared.set(unit, state);
    return state;
  };

  const finish = (state) => {
    // Show the real text and remove the overlay in the same frame.
    state.unit.classList.remove("dd-unit");
    state.host.classList.remove("dd-host");
    state.layer.remove();
    state.images.forEach(({ el, overlay }) => {
      el.classList.remove("dd-media");
      el.style.removeProperty("--dd-blur");
      el.style.removeProperty("clip-path");
      overlay.remove();
    });
    prepared.delete(state.unit);
  };

  const run = (unit, delay) => {
    const state = prepare(unit);
    state.running = true;
    window.setTimeout(() => {
      place(state);
      let step = 0;
      const tick = () => {
        step += 1;
        state.glyphs.forEach((g) => {
          if (g.at === step) {
            g.glyph.textContent = g.ch;
            g.glyph.classList.remove("is-noise");
          } else if (g.at > step && MODE === "uniform") {
            g.glyph.textContent = noiseFor(g);
          }
        });
        noiseImages(state.images, Math.cos((Math.PI / 2) * (step / STEPS)));
        if (step < STEPS) window.setTimeout(tick, STEP_MS);
        else window.setTimeout(() => window.requestAnimationFrame(() => finish(state)), STEP_MS);
      };
      window.setTimeout(tick, STEP_MS);
    }, delay);
  };

  // Only units below the first screen are revealed; they are noised just before they arrive.
  const units = Array.from(document.querySelectorAll(UNITS)).filter((unit) => unit.getBoundingClientRect().top >= window.innerHeight);
  if (!units.length) return;
  const nearObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      prepare(entry.target);
      nearObserver.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px 700px 0px" });
  const revealObserver = new IntersectionObserver((entries) => {
    let index = 0;
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      revealObserver.unobserve(entry.target);
      nearObserver.unobserve(entry.target);
      run(entry.target, index * STAGGER_MS);
      index += 1;
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
  units.forEach((unit) => {
    nearObserver.observe(unit);
    revealObserver.observe(unit);
  });

  // Content above can move (an abstract opens, the window resizes): keep waiting overlays aligned.
  let queued = false;
  const realign = () => {
    queued = false;
    prepared.forEach((state) => place(state));
  };
  const queue = () => {
    if (queued || !prepared.size) return;
    queued = true;
    window.requestAnimationFrame(realign);
  };
  window.addEventListener("resize", queue);
  if ("ResizeObserver" in window) new ResizeObserver(queue).observe(document.body);
})();
