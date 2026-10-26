/* Site background: a Damascene mosaic that slowly changes shape, and words that a flock carries in,
 * forms, holds and carries away.
 *
 * Mosaic: one of several classical designs is chosen at random on every page load. Each is a periodic
 * tiling (squares; octagons and squares; hexagons; triangles and hexagons; dodecagons and triangles)
 * traced by Hankin's method: from every tile edge two rays leave at a contact angle and meet their
 * neighbours' rays, drawing stars and rosettes. The angle varies as a slow wave across the pattern, so
 * tiles shift between crosses, stars and rosettes. It is strongest at the sides of the screen and very
 * faint over the central column, where the page's own animations are.
 *
 * Words: now and then, in a side margin, a faint flock (threads, birds, light or water) drifting up
 * or down the page settles into a small phrase in Arabic calligraphy (Gulzar, a decorative Nastaliq;
 * the Basmala as a composed calligraphic Basmala where the margin is wide enough). The phrase keeps
 * drifting with the current, then loosens back into the flock, which carries on off the page.
 *
 * With reduced motion one still frame of the mosaic is drawn. A footer button pauses everything, and
 * the choice is remembered on this device. */
(() => {
  "use strict";

  // Composed drawings are in assets/img/calligraphy, beside this script's folder.
  const ART_BASE = new URL("../img/calligraphy/", document.currentScript ? document.currentScript.src : window.location.href);
  const lib = window.ResearchMotifs;
  if (!lib || !document.body) return;
  const { palette, rgba, clamp, smooth } = lib;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const narrow = window.matchMedia("(max-width: 767.98px)");
  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;
  const S3 = Math.sqrt(3);
  const FPS = 30;
  const gauss = () => Math.sqrt(-2 * Math.log(Math.random() || 1e-6)) * Math.cos(TAU * Math.random());
  const lerp = (a, b, t) => a + (b - a) * t;

  // Layers. The mosaic changes slowly, so it is redrawn only now and then, on whichever of two canvases
  // is hidden, which then replaces the other in the same frame (drawings a moment apart differ too
  // little to see); in between, a CSS transform carries the scroll parallax (off the main thread). Each
  // mosaic canvas overhangs the window by MARGIN on every side, so the transform never uncovers an
  // edge. The words layer is drawn only while a phrase is on screen.
  const MARGIN = 48;
  const layer = (className) => {
    const c = document.createElement("canvas");
    c.className = className;
    c.setAttribute("aria-hidden", "true");
    return c;
  };
  const mosaics = [0, 1].map(() => {
    const c = layer("ambient ambient-mosaic");
    return { c, g: c.getContext("2d"), at: 0, ox: 0, oy: 0 };
  });
  const wordsCanvas = layer("ambient ambient-words");
  document.body.prepend(mosaics[0].c, mosaics[1].c, wordsCanvas);
  const wctx = wordsCanvas.getContext("2d");
  // The first mosaic canvas carries the state for previews and tests (data-design, -phase, -word).
  const canvas = mosaics[0].c;
  let front = 0;
  let mctx = mosaics[0].g;

  let width = 0;
  let height = 0;
  let time = 0;
  let last = null;
  let frame = null;
  let paused = false;
  try {
    paused = window.localStorage.getItem("ambient-paused") === "1";
  } catch (e) {
    paused = false;
  }

  /* ---------- Mosaic designs ---------- */
  // A regular polygon with n sides, circumradius r, first vertex at startDeg, centred at (cx, cy).
  const regular = (n, r, startDeg, cx = 0, cy = 0) => {
    const out = [];
    for (let k = 0; k < n; k += 1) {
      const a = (startDeg + (360 / n) * k) * DEG;
      out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return out;
  };
  const OCT = 1 + Math.SQRT2;
  const R12 = 1 / (2 * Math.sin(15 * DEG));
  const r12 = 1 / (2 * Math.tan(15 * DEG));
  const at = (cx, cy, r, deg) => [cx + r * Math.cos(deg * DEG), cy + r * Math.sin(deg * DEG)];
  // Lengths are in units of the tile edge; lattice vectors give the repeat.
  const DESIGNS = [
    {
      name: "octagons and squares",
      edge: 36,
      lattice: [[OCT, 0], [0, OCT]],
      tiles: [regular(8, 1 / (2 * Math.sin(22.5 * DEG)), 22.5), regular(4, Math.SQRT1_2, 0, OCT / 2, OCT / 2)],
      theta: [38, 70],
      style: "band",
    },
    {
      name: "hexagons",
      edge: 42,
      lattice: [[S3, 0], [S3 / 2, 1.5]],
      tiles: [regular(6, 1, 30)],
      theta: [52, 74],
      style: "band",
    },
    {
      name: "triangles and hexagons",
      edge: 36,
      lattice: [[2, 0], [1, S3]],
      tiles: [regular(6, 1, 0), [[1, 0], [1.5, S3 / 2], [0.5, S3 / 2]], [[1, 0], [0.5, -S3 / 2], [1.5, -S3 / 2]]],
      theta: [40, 54],
      style: "band",
    },
    {
      name: "dodecagons and triangles",
      edge: 24,
      lattice: [[2 * r12, 0], [r12, S3 * r12]],
      tiles: [
        regular(12, R12, 15),
        [at(0, 0, R12, 15), at(0, 0, R12, 45), at(2 * r12, 0, R12, 135)],
        [at(0, 0, R12, -15), at(2 * r12, 0, R12, -135), at(0, 0, R12, -45)],
      ],
      theta: [56, 76],
      style: "band",
    },
    {
      name: "squares",
      edge: 66,
      lattice: [[1, 0], [0, 1]],
      tiles: [regular(4, Math.SQRT1_2, 45)],
      theta: [22, 38],
      style: "fine",
    },
  ];
  // A preview can request a design with window.AMBIENT_MOSAIC = index.
  const forced = Number.isInteger(window.AMBIENT_MOSAIC) ? window.AMBIENT_MOSAIC : -1;
  const design = DESIGNS[forced >= 0 ? forced % DESIGNS.length : Math.floor(Math.random() * DESIGNS.length)];
  const rotation = [0, 15, 30, 45][Math.floor(Math.random() * 4)] * DEG;
  const sizeJitter = 0.9 + Math.random() * 0.3;
  let edge = design.edge;

  // Hankin's rays for one tile at contact angle theta (from each edge midpoint, towards each corner).
  const hankin = (pts, theta, out) => {
    const n = pts.length;
    let cx = 0;
    let cy = 0;
    pts.forEach((p) => {
      cx += p[0] / n;
      cy += p[1] / n;
    });
    const mids = [];
    const dirs = [];
    for (let i = 0; i < n; i += 1) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy);
      mids.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
      dirs.push([dx / len, dy / len]);
    }
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const inward = (d, p) => {
      const r1 = [d[0] * c - d[1] * s, d[0] * s + d[1] * c];
      const r2 = [d[0] * c + d[1] * s, -d[0] * s + d[1] * c];
      const tx = cx - p[0];
      const ty = cy - p[1];
      return r1[0] * tx + r1[1] * ty > r2[0] * tx + r2[1] * ty ? r1 : r2;
    };
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      const d1 = dirs[i];
      const d2 = [-dirs[j][0], -dirs[j][1]];
      const p1 = mids[i];
      const p2 = mids[j];
      const r1 = inward(d1, p1);
      const r2 = inward(d2, p2);
      const cross = r1[0] * r2[1] - r1[1] * r2[0];
      if (Math.abs(cross) < 1e-6) continue;
      const t = ((p2[0] - p1[0]) * r2[1] - (p2[1] - p1[1]) * r2[0]) / cross;
      const u = ((p2[0] - p1[0]) * r1[1] - (p2[1] - p1[1]) * r1[0]) / cross;
      if (t <= 0 || u <= 0) continue;
      const x = p1[0] + r1[0] * t;
      const y = p1[1] + r1[1] * t;
      out.push(p1[0], p1[1], x, y, p2[0], p2[1], x, y);
    }
  };

  // Brightness levels the light wave is drawn in; fine enough that no tile visibly steps.
  const LEVELS = 24;
  const buckets = Array.from({ length: LEVELS }, () => []);
  // Draws the mosaic with the pattern's origin at (ox, oy), in CSS pixels.
  const drawMosaic = (ox, oy) => {
    const s = edge;
    const cr = Math.cos(rotation);
    const sr = Math.sin(rotation);
    const [a, b] = design.lattice;
    // Lattice to screen: rotate(i * a + j * b) * s + offset.
    const ax = (a[0] * cr - a[1] * sr) * s;
    const ay = (a[0] * sr + a[1] * cr) * s;
    const bx = (b[0] * cr - b[1] * sr) * s;
    const by = (b[0] * sr + b[1] * cr) * s;
    const det = ax * by - ay * bx;
    const toLattice = (x, y) => [((x - ox) * by - (y - oy) * bx) / det, ((y - oy) * ax - (x - ox) * ay) / det];
    const corners = [toLattice(-MARGIN, -MARGIN), toLattice(width + MARGIN, -MARGIN), toLattice(-MARGIN, height + MARGIN), toLattice(width + MARGIN, height + MARGIN)];
    const margin = 3;
    const iMin = Math.floor(Math.min(...corners.map((p) => p[0]))) - margin;
    const iMax = Math.ceil(Math.max(...corners.map((p) => p[0]))) + margin;
    const jMin = Math.floor(Math.min(...corners.map((p) => p[1]))) - margin;
    const jMax = Math.ceil(Math.max(...corners.map((p) => p[1]))) + margin;
    buckets.forEach((bucket) => {
      bucket.length = 0;
    });
    const [lo, hi] = design.theta;
    const tile = [];
    for (let j = jMin; j <= jMax; j += 1) {
      for (let i = iMin; i <= iMax; i += 1) {
        const px = ox + i * ax + j * bx;
        const py = oy + i * ay + j * by;
        if (px < -4 * s * 3 || px > width + 4 * s * 3 || py < -4 * s * 3 || py > height + 4 * s * 3) continue;
        const wave = Math.sin(0.5 * i + 0.33 * j - 0.1 * time) * Math.cos(0.29 * i - 0.41 * j + 0.07 * time);
        const theta = (lerp(lo, hi, 0.5 + 0.5 * wave)) * DEG;
        const light = 0.5 + 0.5 * Math.sin(0.26 * i + 0.17 * j - 0.2 * time);
        const bucket = buckets[Math.min(LEVELS - 1, Math.floor(light * LEVELS))];
        design.tiles.forEach((shape) => {
          tile.length = 0;
          shape.forEach((v) => {
            const x = (v[0] * cr - v[1] * sr) * s;
            const y = (v[0] * sr + v[1] * cr) * s;
            tile.push([px + x, py + y]);
          });
          hankin(tile, theta, bucket);
        });
      }
    }
    const strength = palette.dark ? 0.24 : 0.28;
    const band = design.style === "band";
    mctx.lineCap = "round";
    mctx.lineJoin = "round";
    buckets.forEach((segments, level) => {
      if (!segments.length) return;
      const path = new Path2D();
      for (let k = 0; k < segments.length; k += 4) {
        path.moveTo(segments[k], segments[k + 1]);
        path.lineTo(segments[k + 2], segments[k + 3]);
      }
      const alpha = strength * (0.4 + 0.6 * (level / (LEVELS - 1)));
      mctx.globalCompositeOperation = "source-over";
      mctx.strokeStyle = rgba(palette.accent, alpha);
      if (band) {
        // A band, then its centre carved out: strapwork.
        mctx.lineWidth = narrow.matches ? 3 : 3.8;
        mctx.stroke(path);
        mctx.globalCompositeOperation = "destination-out";
        mctx.strokeStyle = "rgba(0,0,0,1)";
        mctx.lineWidth = narrow.matches ? 1.1 : 1.5;
        mctx.stroke(path);
      } else {
        mctx.lineWidth = 1.15;
        mctx.stroke(path);
      }
    });
    mctx.globalCompositeOperation = "source-over";
  };

  // Strong at the sides, faint over the central column (where the page's animations are).
  const quietCentre = (g, x0, x1) => {
    g.globalCompositeOperation = "destination-out";
    if (narrow.matches) {
      g.fillStyle = "rgba(0,0,0,0.62)";
    } else {
      const column = Math.min(width, 1120);
      const left = (width - column) / 2;
      const gradient = g.createLinearGradient(0, 0, width, 0);
      const edgeStop = clamp((left - 40) / width, 0, 0.45);
      const columnStop = clamp((left + 60) / width, 0.01, 0.48);
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(edgeStop, "rgba(0,0,0,0.12)");
      gradient.addColorStop(columnStop, "rgba(0,0,0,0.8)");
      gradient.addColorStop(0.5, "rgba(0,0,0,0.88)");
      gradient.addColorStop(1 - columnStop, "rgba(0,0,0,0.8)");
      gradient.addColorStop(1 - edgeStop, "rgba(0,0,0,0.12)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gradient;
    }
    g.fillRect(x0, -MARGIN, x1 - x0, height + 2 * MARGIN);
    g.globalCompositeOperation = "source-over";
  };

  /* ---------- Words: small calligraphy carried along the side margins ---------- */
  // Styles. Gulzar (a decorative Nastaliq, SIL OFL) sets every phrase. The Basmala is drawn as Amiri's
  // composed calligraphic Basmala (the one character ﷽, SIL OFL) where the margin is wide enough for
  // its long sweep (minInk), and in Gulzar elsewhere. Both come from Google Fonts, Amiri cut down to
  // that one character.
  const STYLES = {
    gulzar: { family: "Gulzar", css: "family=Gulzar&display=swap", sample: "سلام" },
    basmala: { family: "Amiri", css: `family=Amiri&display=swap&text=${encodeURIComponent("\uFDFD")}`, sample: "\uFDFD", minInk: 30 },
  };
  // Each phrase with full tashkeel (as in the Quranic text where it is a verse), and where it has one,
  // a composed form; styles are tried in order. A phrase can also carry art: composed calligraphic
  // drawings (one colour on a transparent or white ground, in assets/img/calligraphy), one chosen at
  // random each time, drawn with style "art" where the margin is wide enough. Their sources and
  // licences are on the Credits page (_pages/credits.md).
  const PHRASES = [
    { text: "اقْرَأْ" },
    { text: "عَيْنَ الْيَقِينِ" },
    { text: "سَلَامٌ" },
    { text: "وَالَّذِينَ جَاهَدُوا فِينَا لَنَهْدِيَنَّهُمْ سُبُلَنَا" },
    { text: "خَيْرٌ" },
    { text: "قَرَارٌ" },
    { text: "رَبِّ زِدْنِي عِلْمًا" },
    { text: "مَا لِيَ لَا أَرَى الْهُدْهُدَ" },
    { text: "أَمْ خُلِقُوا مِنْ غَيْرِ شَيْءٍ أَمْ هُمُ الْخَالِقُونَ" },
    {
      text: "بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ",
      art: ["basmala-warraich-12.webp", "basmala-warraich-9.webp", "basmala-azzi.webp"],
      composed: "\uFDFD",
      styles: ["art", "basmala", "gulzar"],
    },
    { text: "السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ" },
    { text: "إِنَّ مَعَ الْعُسْرِ يُسْرًا" },
    { text: "إِن يَتَّبِعُونَ إِلَّا الظَّنَّ وَإِنْ هُمْ إِلَّا يَخْرُصُونَ" },
    { text: "الْعُرْوَةُ الْوُثْقَى", art: ["urwa-wuthqa.webp"], styles: ["art", "gulzar"] },
    { text: "قُلْ هُوَ اللَّهُ أَحَدٌ", art: ["ikhlas.webp"], styles: ["art", "gulzar"] },
    { text: "وَهُوَ بِكُلِّ شَيْءٍ عَلِيمٌ", art: ["hadid-57-3.webp"], styles: ["art", "gulzar"] },
    { text: "الْقُرْآنُ الْكَرِيمُ", art: ["quran-kareem.webp"], styles: ["art", "gulzar"] },
  ];
  // A preview can show a drawing with window.AMBIENT_ART = its path (it becomes the last phrase).
  if (typeof window.AMBIENT_ART === "string") PHRASES.push({ text: "", art: [window.AMBIENT_ART], styles: ["art"] });
  const stylesOf = (phrase) => phrase.styles || ["gulzar"];
  const ready = (phrase, style) => (style === "art" ? Boolean(phrase.artImages && phrase.artImages.length) : fontsReady[style]);
  const MODES = ["threads", "birds", "light", "water"];
  const fontsReady = { gulzar: false, basmala: false };
  let fontsRequested = false;
  // Words appear only where the side margins are wide enough, so fonts load only there.
  const marginsFit = () => !narrow.matches && (window.innerWidth - Math.min(window.innerWidth, 1120)) / 2 + 12 >= 64;
  const loadFonts = () => {
    if (fontsRequested || reduced.matches || !marginsFit()) return;
    fontsRequested = true;
    Object.entries(STYLES).forEach(([key, style]) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?${style.css}`;
      link.addEventListener("load", () => {
        if (!document.fonts || !document.fonts.load) return;
        document.fonts.load(`100px "${style.family}"`, style.sample).then((faces) => {
          fontsReady[key] = faces.length > 0;
        }, () => {});
      });
      document.head.appendChild(link);
    });
    // Composed drawings, loaded with the fonts.
    PHRASES.filter((phrase) => phrase.art).forEach((phrase) => {
      phrase.artImages = [];
      phrase.art.forEach((file) => {
        const img = new Image();
        img.addEventListener("load", () => phrase.artImages.push(img));
        img.src = new URL(file, ART_BASE).href;
      });
    });
  };

  // A shuffled order, so every phrase appears before any repeats.
  let bag = [];
  const nextPhrase = () => {
    // A preview can request a phrase with window.AMBIENT_PHRASE = index.
    if (Number.isInteger(window.AMBIENT_PHRASE)) return PHRASES[window.AMBIENT_PHRASE % PHRASES.length];
    if (!bag.length) {
      bag = PHRASES.slice();
      for (let i = bag.length - 1; i > 0; i -= 1) {
        const k = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[k]] = [bag[k], bag[i]];
      }
    }
    return bag.pop();
  };

  // Draw text centred on a canvas and return its ink box. The canvas is sized from the measured text,
  // with room around it (Nastaliq cascades tall; the composed Basmala is very wide).
  const sizer = document.createElement("canvas").getContext("2d");
  const inkOf = (text, font, size) => {
    sizer.font = font(size);
    const m = sizer.measureText(text);
    const w = Math.ceil(Math.max(m.width, (m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || 0)) + size * 4);
    const h = Math.ceil(size * 4);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const cctx = c.getContext("2d", { willReadFrequently: true });
    cctx.font = font(size);
    cctx.direction = "rtl";
    cctx.textAlign = "center";
    cctx.textBaseline = "middle";
    cctx.fillStyle = "#000";
    cctx.fillText(text, w / 2, h / 2);
    const data = cctx.getImageData(0, 0, w, h).data;
    let x0 = w;
    let x1 = -1;
    let y0 = h;
    let y1 = -1;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (data[(y * w + x) * 4 + 3] > 40) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    return x1 < 0 ? null : { canvas: c, data, w, h, x0, y0, x1, y1 };
  };

  const fontOf = (style) => (px) => `400 ${px}px "${STYLES[style].family}"`;

  // Ink boxes measured at 60px, cached: line breaking measures the same words repeatedly.
  const measured = new Map();
  const measure = (text, style) => {
    const key = `${style}|${text}`;
    if (!measured.has(key)) {
      const ink = inkOf(text, fontOf(style), 60);
      measured.set(key, ink && { w: ink.x1 - ink.x0 + 1, h: ink.y1 - ink.y0 + 1 });
    }
    return measured.get(key);
  };

  // Break a phrase at spaces into at most four lines, choosing the largest ink height that fits
  // maxW (an extra line costs a little, so short phrases stay on one line).
  const layout = (text, style, inkH, maxW) => {
    const full = measure(text, style);
    if (!full) return null;
    const unit = inkH / full.h;
    const words = text.split(" ");
    let best = null;
    for (let mask = 0; mask < 1 << (words.length - 1); mask += 1) {
      const lines = [];
      let line = [words[0]];
      for (let k = 1; k < words.length; k += 1) {
        if (mask & (1 << (k - 1))) {
          lines.push(line.join(" "));
          line = [words[k]];
        } else line.push(words[k]);
      }
      lines.push(line.join(" "));
      if (lines.length > 4) continue;
      const widest = Math.max(...lines.map((l) => (measure(l, style) || { w: Infinity }).w)) * unit;
      const fit = inkH * Math.min(1, maxW / widest);
      const score = fit * Math.pow(0.85, lines.length - 1);
      if (!best || score > best.score) best = { lines, fit, score };
    }
    return best;
  };

  // One line of Thuluth or Diwani, cropped to its ink.
  const scriptLine = (line, style, size) => {
    const ink = inkOf(line, fontOf(style), size);
    if (!ink) return null;
    const pad = 2;
    const x0 = Math.max(0, ink.x0 - pad);
    const y0 = Math.max(0, ink.y0 - pad);
    const w = Math.min(ink.w - 1, ink.x1 + pad) - x0 + 1;
    const h = Math.min(ink.h - 1, ink.y1 + pad) - y0 + 1;
    const image = document.createElement("canvas");
    image.width = w;
    image.height = h;
    image.getContext("2d").drawImage(ink.canvas, x0, y0, w, h, 0, 0, w, h);
    const points = [];
    const step = Math.max(2, Math.round(size / 26));
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        if (ink.data[((y + y0) * ink.w + (x + x0)) * 4 + 3] > 150) points.push([x, y]);
      }
    }
    return { image, w, h, points };
  };

  // A composed drawing, sized to the margin (at most 240px wide and 42% of the window's height), its
  // ink taken from its dark or coloured pixels so that any single colour works; null if it would be
  // narrower than 90px.
  const renderArt = (img, maxW) => {
    const aspect = (img.naturalHeight || 300) / (img.naturalWidth || 300);
    const w = Math.round(Math.min(maxW, 240, (height * 0.42) / aspect));
    const h = Math.round(w * aspect);
    if (w < 90) return null;
    const image = document.createElement("canvas");
    image.width = w;
    image.height = h;
    const g = image.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0, w, h);
    const pixels = g.getImageData(0, 0, w, h);
    const d = pixels.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
      const ink = (d[i + 3] / 255) * clamp((1 - lum) / 0.6, 0, 1);
      d[i] = 0;
      d[i + 1] = 0;
      d[i + 2] = 0;
      d[i + 3] = Math.round(ink * 255);
    }
    g.putImageData(pixels, 0, 0);
    const points = [];
    const step = Math.max(2, Math.round(w / 48));
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        if (d[(y * w + x) * 4 + 3] > 150) points.push([x, y]);
      }
    }
    while (points.length > 320) points.splice(Math.floor(Math.random() * points.length), 1);
    return { image, w, h, points, lines: 1 };
  };

  // A phrase as an image, always level, plus points on its ink. Long phrases are set on stacked,
  // centred lines so they fit across maxW at a readable size; null if they would be smaller than minH.
  const renderGlyph = (phrase, style, inkH, maxW, minH) => {
    if (style === "art") return renderArt(phrase.artImages[Math.floor(Math.random() * phrase.artImages.length)], maxW);
    const text = style === "basmala" ? phrase.composed : phrase.text;
    const plan = layout(text, style, inkH, maxW);
    if (!plan || plan.fit < minH) return null;
    const size = 60 * (plan.fit / measure(text, style).h);
    const parts = plan.lines.map((line) => scriptLine(line, style, size));
    const gap = Math.round(plan.fit * 0.22);
    if (parts.some((p) => !p)) return null;
    const w = Math.max(...parts.map((p) => p.w));
    const h = parts.reduce((sum, p) => sum + p.h, 0) + gap * (parts.length - 1);
    const image = document.createElement("canvas");
    image.width = w;
    image.height = h;
    const ictx = image.getContext("2d");
    const points = [];
    let top = 0;
    parts.forEach((p) => {
      const left = Math.round((w - p.w) / 2);
      ictx.drawImage(p.image, left, top);
      p.points.forEach(([x, y]) => points.push([x + left, y + top]));
      top += p.h + gap;
    });
    while (points.length > 320) points.splice(Math.floor(Math.random() * points.length), 1);
    return { image, w, h, points, lines: parts.length };
  };

  const tintOf = (image) => {
    const tint = document.createElement("canvas");
    tint.width = image.width;
    tint.height = image.height;
    const tctx = tint.getContext("2d");
    tctx.drawImage(image, 0, 0);
    tctx.globalCompositeOperation = "source-in";
    tctx.fillStyle = rgba(palette.accent, 1);
    tctx.fillRect(0, 0, tint.width, tint.height);
    return tint;
  };

  const FORM = 3.4;
  const HOLD = 3.6;
  const LEAVE = 3.2;
  let piece = null;
  let nextAt = 3;
  let lastSide = Math.random() < 0.5 ? -1 : 1;

  const compose = () => {
    // Only in the side margins, and only where they are wide enough.
    const column = Math.min(width, 1120);
    const gutter = (width - column) / 2 + 12;
    if (narrow.matches || gutter < 64) return null;
    const phrase = nextPhrase();
    const styles = stylesOf(phrase).filter((s) => ready(phrase, s));
    // A preview can request a style with window.AMBIENT_STYLE = "gulzar", "basmala" or "art".
    const order = styles.includes(window.AMBIENT_STYLE) ? [window.AMBIENT_STYLE] : styles;
    // Always written level, so it reads; long phrases break onto lines to fit across the margin. The
    // first style that fits is used.
    const inkH = clamp(gutter * 0.28, 28, 44);
    let style = null;
    let glyph = null;
    for (const s of order) {
      glyph = renderGlyph(phrase, s, inkH, gutter - 36, (STYLES[s] && STYLES[s].minInk) || 22);
      if (glyph && glyph.points.length) {
        style = s;
        break;
      }
    }
    if (!style) return null;
    const along = glyph.h;
    if (along > height * 0.5) return null;
    lastSide = -lastSide;
    const cx = lastSide < 0 ? gutter / 2 : width - gutter / 2;
    // The flock and the phrase drift straight up or down the margin, never across it.
    const vx = 0;
    const vy = Math.random() < 0.5 ? -1 : 1;
    const nx = -vy;
    const ny = 0;
    const speed = 15 + Math.random() * 9;
    // Centre the phrase on screen half-way through its hold, so it is visible while it drifts.
    const mid = FORM + HOLD / 2;
    const cy = clamp(height * (0.3 + 0.4 * Math.random()), 90 + along / 2 + speed * mid, height - 20 - along / 2 - speed * mid);
    const c0 = [cx, cy - vy * speed * mid];
    const mode = MODES.includes(window.AMBIENT_MODE) ? window.AMBIENT_MODE : MODES[Math.floor(Math.random() * MODES.length)];
    const particles = glyph.points.map(([px, py]) => {
      const ox = px - glyph.w / 2;
      const oy = py - glyph.h / 2;
      // Position along the heading: the front of the phrase leaves first.
      const front = clamp((oy * vy) / Math.max(1, along) + 0.5, 0, 1);
      const t0 = Math.random() * 0.9;
      const t1 = t0 + 2.1 + Math.random() * 0.4 + (1 - front) * 0.3;
      const t2 = FORM + HOLD + (1 - front) * 0.7 + Math.random() * 0.3;
      return {
        ox, oy, t0, t1, t2,
        t3: t2 + LEAVE - 0.6 + Math.random() * 0.6,
        behind: 150 + Math.random() * 230,
        ahead: 160 + Math.random() * 260,
        lat: gauss() * (mode === "birds" ? 10 : 16),
        lat2: gauss() * 18,
        phase: Math.random() * TAU,
        size: 0.45 + Math.random() * 0.3,
        trail: [],
      };
    });
    const arrivals = particles.map((p) => p.t1).sort((a, b) => a - b);
    return {
      ...glyph, tint: tintOf(glyph.image), style, mode, start: time, speed, c0, v: [vx, vy], n: [nx, ny], particles, arrivals,
      leave: FORM + HOLD,
      end: Math.max(...particles.map((p) => p.t3)),
    };
  };

  // The phrase's centre: it drifts the whole time.
  const centreOf = (piece, age) => [piece.c0[0] + piece.v[0] * piece.speed * age, piece.c0[1] + piece.v[1] * piece.speed * age];

  const positionOf = (piece, p, age, c) => {
    const [vx, vy] = piece.v;
    const [nx, ny] = piece.n;
    let along = 0;
    let lat = 0;
    let loose = 0;
    if (age < p.t1) {
      // Catching up from behind, along the current, and settling into place.
      const u = clamp((age - p.t0) / (p.t1 - p.t0), 0, 1);
      const e = 1 - Math.pow(1 - u, 2.2);
      along = -p.behind * (1 - e);
      lat = p.lat * Math.pow(1 - e, 1.6);
      loose = 1 - e;
    } else if (age >= p.t2) {
      // Lifting off ahead, along the same current.
      const u = clamp((age - p.t2) / (p.t3 - p.t2), 0, 1);
      const e = u * u;
      along = p.ahead * e;
      lat = p.lat2 * e * e;
      loose = e;
    }
    let x = c[0] + p.ox + vx * along + nx * lat;
    let y = c[1] + p.oy + vy * along + ny * lat;
    if (loose > 0) {
      const sway = piece.mode === "water" ? 7 * Math.sin(along * 0.05 + p.phase) : piece.mode === "birds" ? 5 * Math.sin(age * 2.2 + p.phase) : 3 * Math.sin(age * 1.4 + p.phase);
      x += nx * sway * loose;
      y += ny * sway * loose;
    }
    return [x, y, age < p.t1 || age >= p.t2];
  };

  const drawBird = (path, x, y, vx, vy, size, flap) => {
    const angle = Math.atan2(vy, vx);
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const span = 6.8 * size;
    const lift = (1.6 + 3.6 * flap) * size;
    const pt = (fx, fy) => [x + fx * c - fy * s, y + fx * s + fy * c];
    const tipL = pt(-3.4 * size, -span);
    const tipR = pt(-3.4 * size, span);
    const ctrlL = pt(0.6 * size, -span * 0.45 - lift * 0.2);
    const ctrlR = pt(0.6 * size, span * 0.45 + lift * 0.2);
    const body = pt(1.2 * size, 0);
    const dropL = pt(-1.2 * size - lift, -span * 0.85);
    const dropR = pt(-1.2 * size - lift, span * 0.85);
    path.moveTo(tipL[0], tipL[1]);
    path.quadraticCurveTo(dropL[0] * 0.5 + ctrlL[0] * 0.5, dropL[1] * 0.5 + ctrlL[1] * 0.5, body[0], body[1]);
    path.quadraticCurveTo(dropR[0] * 0.5 + ctrlR[0] * 0.5, dropR[1] * 0.5 + ctrlR[1] * 0.5, tipR[0], tipR[1]);
  };

  const drawPiece = () => {
    const age = time - piece.start;
    const c = centreOf(piece, age);
    // Kept faint, so the words belong to the background.
    const ink = palette.dark ? 0.34 : 0.36;
    let arrived = 0;
    while (arrived < piece.arrivals.length && piece.arrivals[arrived] <= age) arrived += 1;
    const formed = smooth(arrived / piece.arrivals.length);
    const fading = 1 - smooth((age - piece.leave) / 1.1);
    if (formed > 0.01 && fading > 0.01) {
      wctx.save();
      wctx.translate(c[0], c[1]);
      // Veil the mosaic softly behind the phrase (an oval cartouche of the page's own background),
      // so the letters read.
      wctx.save();
      wctx.scale(piece.w / 2 + 16, piece.h / 2 + 16);
      const clearing = wctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      const depth = 0.8 * formed * fading;
      clearing.addColorStop(0, rgba(palette.bg, depth.toFixed(3)));
      clearing.addColorStop(0.6, rgba(palette.bg, (depth * 0.75).toFixed(3)));
      clearing.addColorStop(1, rgba(palette.bg, 0));
      wctx.fillStyle = clearing;
      wctx.beginPath();
      wctx.arc(0, 0, 1, 0, TAU);
      wctx.fill();
      wctx.restore();
      wctx.globalAlpha = ink * Math.pow(formed, 1.4) * fading;
      wctx.drawImage(piece.tint, -piece.w / 2, -piece.h / 2);
      wctx.restore();
    }
    const birds = new Path2D();
    const dots = new Path2D();
    const halos = new Path2D();
    const streaks = [new Path2D(), new Path2D(), new Path2D()];
    let alive = 0;
    piece.particles.forEach((p) => {
      if (age < p.t0 || age > p.t3) return;
      alive += 1;
      const [x, y, moving] = positionOf(piece, p, age, c);
      // Appear softly, fade into the ink on arrival, re-emerge and fade out on departure.
      let alpha;
      if (age < p.t1) alpha = smooth((age - p.t0) / 0.7) * (1 - smooth((age - p.t1 + 0.35) / 0.35));
      else if (age < p.t2) alpha = 0;
      else alpha = smooth((age - p.t2) / 0.3) * (1 - smooth((age - p.t3 + 1.2) / 1.2));
      if (!moving) {
        p.trail.length = 0;
        return;
      }
      const prev = p.trail.length ? p.trail[p.trail.length - 1] : [x - piece.v[0], y - piece.v[1]];
      p.trail.push([x, y]);
      const keep = piece.mode === "threads" ? 11 : piece.mode === "water" ? 5 : 3;
      if (p.trail.length > keep) p.trail.shift();
      if (alpha < 0.02) return;
      const vx = x - prev[0];
      const vy = y - prev[1];
      if (piece.mode === "birds") {
        const flap = 0.5 + 0.5 * Math.sin(age * 10 + p.phase);
        const still = Math.abs(vx) + Math.abs(vy) < 0.15;
        drawBird(birds, x, y, still ? piece.v[0] : vx, still ? piece.v[1] : vy, p.size, flap);
      } else if (piece.mode === "light") {
        dots.moveTo(x + 1, y);
        dots.arc(x, y, 1, 0, TAU);
        halos.moveTo(x + 2.8, y);
        halos.arc(x, y, 2.8, 0, TAU);
      } else {
        const n = p.trail.length;
        for (let k = 1; k < n; k += 1) {
          const band = Math.min(2, Math.floor((k / n) * 3));
          streaks[band].moveTo(p.trail[k - 1][0], p.trail[k - 1][1]);
          streaks[band].lineTo(p.trail[k][0], p.trail[k][1]);
        }
      }
      p.alpha = alpha;
    });
    const tone = rgba(palette.accent, 1);
    const strength = ink * 0.85;
    wctx.lineCap = "round";
    if (piece.mode === "birds") {
      wctx.globalAlpha = strength;
      wctx.strokeStyle = tone;
      wctx.lineWidth = 1;
      wctx.stroke(birds);
    } else if (piece.mode === "light") {
      wctx.globalAlpha = strength * 0.25;
      wctx.fillStyle = tone;
      wctx.fill(halos);
      wctx.globalAlpha = strength;
      wctx.fill(dots);
    } else {
      wctx.strokeStyle = tone;
      wctx.lineWidth = piece.mode === "water" ? 1.1 : 0.8;
      [0.25, 0.55, 1].forEach((k, band) => {
        wctx.globalAlpha = strength * k;
        wctx.stroke(streaks[band]);
      });
    }
    wctx.globalAlpha = 1;
    if (!alive && age > piece.leave) piece = null;
  };

  /* ---------- Loop ---------- */
  // The mosaic stays on the screen's pixel grid, so its thin lines never shimmer as it moves: each
  // canvas pixel covers a whole number of screen pixels (at most two canvas pixels per CSS pixel),
  // the pattern is drawn at an origin rounded to a canvas pixel, and the layers move only by whole
  // canvas pixels.
  const gridRatio = () => {
    const dpr = window.devicePixelRatio || 1;
    return dpr / Math.ceil(dpr / 2);
  };
  let mosaicRatio = gridRatio();
  const snap = (v) => Math.round(v * mosaicRatio) / mosaicRatio;
  // Where the pattern's origin is now, on the grid. It does not drift (a pixel-sharp pattern can only
  // move in whole-pixel steps, which read as jitter); it shifts only with the parallax of scrolling.
  const anchor = () => [0, snap(-(window.scrollY || 0) * 0.06)];
  const sizeMosaics = () => {
    mosaics.forEach((m) => {
      m.c.width = Math.round((width + 2 * MARGIN) * mosaicRatio);
      m.c.height = Math.round((height + 2 * MARGIN) * mosaicRatio);
      // Sized here rather than in CSS (the site's CSS minifier breaks calc()), to exactly the canvas's
      // pixels, so none is stretched.
      Object.assign(m.c.style, { left: `${-MARGIN}px`, top: `${-MARGIN}px`, right: "auto", bottom: "auto", width: `${m.c.width / mosaicRatio}px`, height: `${m.c.height / mosaicRatio}px` });
      m.g.setTransform(mosaicRatio, 0, 0, mosaicRatio, MARGIN * mosaicRatio, MARGIN * mosaicRatio);
    });
    dirty = true;
  };
  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    width = window.innerWidth;
    height = window.innerHeight;
    mosaicRatio = gridRatio();
    sizeMosaics();
    wordsCanvas.width = Math.round(width * ratio);
    wordsCanvas.height = Math.round(height * ratio);
    wctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    edge = design.edge * sizeJitter * (narrow.matches ? 0.82 : 1);
  };

  // How long a drawing of the mosaic takes here, in milliseconds (smoothed). It is measured as the
  // extra length of the frame that follows a drawing, since the browser rasterises the lines after
  // the drawing calls return; it sets how often the mosaic is redrawn.
  let cost = 16;
  let measuring = false;
  let dirty = true;
  // Draw on the hidden canvas and show it in place of the other, in the same frame. (A crossfade would
  // dim the faint lines halfway through, and restart before it finished: a visible flicker.)
  const drawMosaicLayer = () => {
    const back = mosaics[1 - front];
    mctx = back.g;
    mctx.clearRect(-MARGIN, -MARGIN, width + 2 * MARGIN, height + 2 * MARGIN);
    const [ox, oy] = anchor();
    drawMosaic(ox, oy);
    quietCentre(mctx, -MARGIN, width + MARGIN);
    back.at = time;
    back.ox = ox;
    back.oy = oy;
    back.c.style.opacity = "1";
    mosaics[front].c.style.opacity = "0";
    front = 1 - front;
    dirty = false;
    measuring = true;
  };
  // Each canvas moves from where its pattern was drawn to where the pattern is now (both on the grid,
  // so the two canvases always agree when one replaces the other). The mosaic is redrawn every 12
  // drawing-lengths (between 250 ms and 1.5 s, so it stays a small share of the main thread), and at
  // once if it has moved near the end of its overhang.
  const shiftOf = (m) => {
    const [ox, oy] = anchor();
    return [ox - m.ox, oy - m.oy];
  };
  const placeMosaic = (moving) => {
    const [dx, dy] = shiftOf(mosaics[front]);
    const interval = clamp(cost * 12, 250, 1500);
    const far = Math.abs(dx) > MARGIN * 0.75 || Math.abs(dy) > MARGIN * 0.75;
    const due = moving && (time - mosaics[front].at) * 1000 >= interval;
    if (dirty || far || due) drawMosaicLayer();
    mosaics.forEach((m) => {
      const [x, y] = shiftOf(m);
      m.c.style.transform = `translate3d(${x.toFixed(4)}px, ${y.toFixed(4)}px, 0)`;
    });
  };
  // Called with the length of the frame after a drawing. Where drawing stays slow, the mosaic drops
  // to half its resolution (still a whole number of screen pixels per canvas pixel).
  const noteCost = (frameMs) => {
    measuring = false;
    cost = 0.6 * cost + 0.4 * Math.max(0, frameMs - 1000 / 60);
    if (cost > 60 && mosaicRatio >= 1.5) {
      mosaicRatio /= 2;
      sizeMosaics();
    }
  };

  let wordsDrawn = false;
  const drawWords = () => {
    if (!piece && time >= nextAt) {
      piece = compose();
      nextAt = time + (piece ? piece.end : 2) + 5 + Math.random() * 7;
    }
    if (!piece && !wordsDrawn) return;
    wctx.clearRect(0, 0, width, height);
    wordsDrawn = Boolean(piece);
    if (!piece) return;
    drawPiece();
    // Fade toward the central column like the mosaic (words are drawn only in the margins).
    const reach = (width - Math.min(width, 1120)) / 2 + 80;
    quietCentre(wctx, 0, reach);
    quietCentre(wctx, width - reach, width);
  };
  const clearWords = () => {
    piece = null;
    wordsDrawn = false;
    wctx.clearRect(0, 0, width, height);
  };

  const status = () => {
    const age = piece ? time - piece.start : -1;
    canvas.dataset.phase = !piece ? "" : age < piece.arrivals[piece.arrivals.length - 1] ? "forming" : age < piece.leave ? "holding" : "leaving";
    canvas.dataset.word = piece ? `${piece.style} ${piece.lines} ${piece.w}x${piece.h} ${centreOf(piece, age).map(Math.round).join(",")}` : "";
  };

  let wordsAt = -1;
  const tick = (now) => {
    const dt = last === null ? 0 : (now - last) / 1000;
    if (measuring && last !== null) noteCost(dt * 1000);
    last = now;
    time += Math.min(dt, 0.1);
    placeMosaic(true);
    if (time - wordsAt >= 1 / FPS) {
      wordsAt = time;
      drawWords();
    }
    status();
    frame = window.requestAnimationFrame(tick);
  };
  // With reduced motion, when paused or in a hidden tab: one still frame, moved only by scrolling.
  const still = () => {
    clearWords();
    placeMosaic(false);
    status();
  };
  const sync = () => {
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
    last = null;
    measuring = false;
    if (!reduced.matches && !paused && !document.hidden) frame = window.requestAnimationFrame(tick);
    else still();
  };

  // Footer control: pause or play the background (remembered on this device).
  const toggle = document.querySelector("[data-ambient-toggle]");
  const label = () => {
    if (!toggle) return;
    toggle.hidden = reduced.matches;
    toggle.textContent = paused ? "Play background animation" : "Pause background animation";
    toggle.setAttribute("aria-pressed", String(paused));
  };
  if (toggle) {
    toggle.addEventListener("click", () => {
      paused = !paused;
      try {
        window.localStorage.setItem("ambient-paused", paused ? "1" : "0");
      } catch (e) {
        /* Not stored; the choice lasts for this page. */
      }
      label();
      sync();
    });
  }

  window.addEventListener("resize", () => {
    resize();
    loadFonts();
    // A resize invalidates the phrase's position; let it go and start a new one later.
    clearWords();
    if (frame === null) still();
  });
  // While still, scrolling only moves the layer (redrawn near the end of its overhang).
  let scrollQueued = false;
  window.addEventListener("scroll", () => {
    if (frame !== null || scrollQueued) return;
    scrollQueued = true;
    window.requestAnimationFrame(() => {
      scrollQueued = false;
      if (frame === null) placeMosaic(false);
    });
  }, { passive: true });
  document.addEventListener("visibilitychange", sync);
  document.addEventListener("motifs:palette", () => {
    if (piece) piece.tint = tintOf(piece.image);
    dirty = true;
    if (frame === null) still();
  });
  if (reduced.addEventListener) {
    reduced.addEventListener("change", () => {
      label();
      sync();
    });
  }

  canvas.dataset.design = design.name;
  resize();
  label();
  loadFonts();
  sync();
})();
