/* CV page. Education and experience float along a timeline in 3D space that soars from left (oldest)
 * to right (now); other dated entries are floating cards. Any card opens full screen: the panel grows
 * out of the card's own rectangle, and retracts into it on close. Also: section filters, search, date
 * bars on a shared timeline, and generated emblems for organizations without a logo. All CV content
 * is in the page already; this script only arranges and animates it. */
(() => {
  "use strict";

  const root = document.querySelector("[data-cv]");
  if (!root) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const TAU = Math.PI * 2;
  root.classList.add("cv-js");

  /* ---------- Publications: the PDF's entries, with figures, method names and links from papers.bib ---------- */
  // Entries are matched by title; an entry without a match stays in the plain list.
  const pubList = root.querySelector(".cv-pubs");
  const pubMedia = root.querySelector("[data-cv-pub-media]");
  if (pubList && pubMedia && pubMedia.content) {
    const simplify = (text) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const media = Array.from(pubMedia.content.querySelectorAll("[data-title]"));
    const orbit = document.createElement("div");
    orbit.className = "cv-orbit cv-orbit-pubs";
    orbit.setAttribute("data-cv-orbit", "");
    const line = document.createElement("canvas");
    line.className = "cv-orbit-line";
    line.setAttribute("aria-hidden", "true");
    const list = document.createElement("ul");
    list.className = "cv-cards";
    orbit.append(line, list);
    const make = (tag, className, text) => {
      const el = document.createElement(tag);
      if (className) el.className = className;
      if (text !== undefined) el.textContent = text;
      return el;
    };
    Array.from(pubList.children).forEach((item) => {
      const citation = item.textContent.trim();
      const match = media.find((m) => simplify(citation).includes(simplify(m.dataset.title)));
      if (!match) return;
      const d = match.dataset;
      const slot = make("li", "cv-card-slot");
      slot.setAttribute("data-cv-item", "");
      const card = make("article", "cv-card cv-pub-card");
      card.setAttribute("data-cv-card", "");
      card.dataset.kind = "publication";
      card.dataset.section = "Publications";
      card.dataset.date = d.year;
      ["paper", "arxiv", "pdf", "code", "website"].forEach((key) => {
        if (d[key]) card.dataset[key] = d[key];
      });
      const emblem = make("div", "cv-emblem cv-figure");
      if (d.figure) {
        const img = new Image();
        img.src = d.figure;
        img.alt = `Main figure of ${d.method}`;
        img.loading = "lazy";
        img.decoding = "async";
        emblem.appendChild(img);
      }
      const role = d.title.startsWith(`${d.method}:`) ? d.title.slice(d.method.length + 1).trim() : d.title;
      const meta = make("p", "cv-card-meta");
      meta.append(make("span", "cv-date", d.year), make("span", "cv-place", d.venue));
      const details = make("ul", "cv-card-details");
      details.appendChild(make("li", "", citation));
      const span = make("span", "cv-span");
      span.setAttribute("aria-hidden", "true");
      span.appendChild(make("span", "cv-span-bar"));
      const open = make("button", "cv-card-open");
      open.type = "button";
      open.hidden = true;
      open.setAttribute("data-cv-open", "");
      open.setAttribute("aria-haspopup", "dialog");
      open.appendChild(make("span", "sr-only", `Open details: ${d.method}`));
      card.append(emblem, make("h3", "cv-card-title", d.method), make("p", "cv-card-role", role), meta, details, span, open);
      slot.appendChild(card);
      list.appendChild(slot);
      item.remove();
    });
    if (list.children.length) pubList.before(orbit);
    if (!pubList.children.length) pubList.remove();
  }

  const cards = Array.from(root.querySelectorAll("[data-cv-card]"));
  const sections = Array.from(root.querySelectorAll("[data-cv-section]"));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (t) => {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  };

  /* ---------- Dates: a span for each entry on one timeline from the earliest year to now ---------- */
  const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const now = new Date();
  const nowValue = now.getFullYear() + now.getMonth() / 12;
  // Reads only what the CV states: "Sept 2021 - Sept 2024", "July 2021 - Present", "Oct 2019", "2018 - 2021".
  const parseSpan = (text) => {
    const points = [];
    const pattern = /(?:([A-Za-z]{3,9})\.?\s+)?(\d{4})|(present|current|now)/gi;
    let match;
    while ((match = pattern.exec(text))) {
      if (match[3]) {
        points.push({ value: nowValue, month: true, present: true });
        continue;
      }
      const month = match[1] ? MONTHS[match[1].slice(0, 3).toLowerCase()] : undefined;
      points.push({ value: Number(match[2]) + (month === undefined ? 0 : month / 12), month: month !== undefined });
    }
    if (!points.length) return null;
    const first = points[0];
    const last = points[points.length - 1];
    // A year without a month covers that whole year; a single month covers that month.
    const end = last.value + (last.month ? 1 / 12 : 1);
    return { start: first.value, end: Math.max(end, first.value + 1 / 12), present: Boolean(last.present) };
  };
  const spans = new Map();
  cards.forEach((card) => {
    const span = parseSpan(card.dataset.date || "");
    if (span) spans.set(card, span);
  });
  const values = Array.from(spans.values());
  const axisStart = values.length ? Math.floor(Math.min(...values.map((s) => s.start))) : 0;
  const axisEnd = values.length ? Math.ceil(Math.max(nowValue, ...values.map((s) => s.end))) : 1;
  const toPercent = (value) => ((value - axisStart) / Math.max(1, axisEnd - axisStart)) * 100;
  cards.forEach((card) => {
    const bar = card.querySelector(".cv-span-bar");
    const span = spans.get(card);
    if (!bar || !span) return;
    bar.style.left = `${toPercent(span.start)}%`;
    bar.style.width = `${Math.max(1.2, toPercent(span.end) - toPercent(span.start))}%`;
    if (span.end >= nowValue) bar.classList.add("is-ongoing");
  });
  // Length of a span in words, from the stated dates ("3 years", "1 year 2 months", "2 months").
  const duration = (span) => {
    const months = Math.max(1, Math.round((span.end - span.start) * 12));
    const years = Math.floor(months / 12);
    const rest = months % 12;
    const parts = [];
    if (years) parts.push(`${years} year${years === 1 ? "" : "s"}`);
    if (rest) parts.push(`${rest} month${rest === 1 ? "" : "s"}`);
    return parts.join(" ");
  };

  /* ---------- Generated emblems: initials over a symmetric pattern seeded by the name ---------- */
  const SMALL = new Set(["of", "on", "the", "and", "for", "in", "now", "based", "&"]);
  const initials = (name) => {
    const acronym = (name.match(/\(([^)]+)\)/) || [])[1];
    if (acronym && /^[A-Z0-9][A-Z0-9 &-]{1,8}$/.test(acronym.trim())) return acronym.replace(/\s+AI$/, "").replace(/[^A-Z0-9]/g, "").slice(0, 6);
    const words = name.replace(/\(.*?\)/g, "").split(/\s+/).filter((w) => /^\p{L}/u.test(w) && !SMALL.has(w.toLowerCase()));
    return words.slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("");
  };
  const hash = (text) => {
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
  };
  root.querySelectorAll(".cv-monogram").forEach((mark) => {
    const name = mark.dataset.name || mark.textContent;
    let bits = hash(name);
    const dots = [];
    for (let row = 0; row < 5; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        const on = bits & 1;
        bits = (bits >>> 1) | ((bits & 1) << 31);
        if (!on) continue;
        [col, 4 - col].forEach((c, i) => {
          if (i === 1 && c === col) return;
          dots.push(`<circle cx="${6 + c * 7}" cy="${6 + row * 7}" r="2.2" />`);
        });
      }
    }
    const letters = initials(name);
    mark.dataset.length = String(Math.min(letters.length, 6));
    mark.innerHTML = `<svg class="cv-pattern" viewBox="0 0 40 40" aria-hidden="true">${dots.join("")}</svg><span>${letters}</span>`;
  });

  /* ---------- Floating grid cards: each drifts on its own phase (CSS) ---------- */
  cards.forEach((card, index) => {
    card.style.setProperty("--float-delay", `${-((index * 1.7) % 7).toFixed(2)}s`);
    card.style.setProperty("--float-duration", `${6.5 + (index % 4) * 0.6}s`);
  });

  /* ---------- The 3D timeline ---------- */
  const orbits = Array.from(root.querySelectorAll("[data-cv-orbit]")).map((container) => {
    const list = container.querySelector(".cv-cards");
    const canvas = container.querySelector("canvas");
    // Oldest first, left to right (and in the reading order of the page).
    const slots = Array.from(list.children).sort((a, b) => {
      const sa = spans.get(a.querySelector("[data-cv-card]"));
      const sb = spans.get(b.querySelector("[data-cv-card]"));
      return (sa ? sa.start : 0) - (sb ? sb.start : 0);
    });
    slots.forEach((slot) => list.appendChild(slot));
    return { container, list, canvas, ctx: canvas.getContext("2d"), slots, mode: "", w: 0, h: 0, cardW: 0, cardH: 0, hover: -1, pointer: [0, 0], aim: [0, 0] };
  });

  const palette = () => {
    const style = getComputedStyle(document.documentElement);
    return {
      accent: style.getPropertyValue("--global-theme-color").trim() || "#087f83",
      ink: style.getPropertyValue("--global-text-color").trim() || "#23332e",
      rule: style.getPropertyValue("--global-divider-color").trim() || "#d9e1db",
      dark: document.documentElement.getAttribute("data-theme") === "dark",
    };
  };
  let colors = palette();

  // The path: x across, rising towards the right, coming nearer (depth 0.86 to 1).
  const pathPoint = (o, s, t) => {
    const x = o.w * (0.07 + 0.86 * s);
    const rise = 0.24 * smooth(s);
    const y = o.h * (0.6 - rise) + 14 * Math.sin(TAU * (s * 1.1 + 0.08 * t));
    const depth = 0.86 + 0.14 * s;
    return [x, y, depth];
  };
  // Parallax: nearer points move more with the slow sway and the pointer.
  const parallax = (o, depth, t) => {
    const sway = reduced.matches ? 0 : 0.45 * Math.sin(t * 0.21);
    const k = depth - 0.93;
    return [(sway + o.pointer[0]) * k * 140, o.pointer[1] * k * 50];
  };

  const layoutOrbit = (o) => {
    const width = o.container.clientWidth;
    // While searching (some cards hidden) the timeline becomes a plain list.
    const mode = width >= 880 && !o.container.classList.contains("is-filtered") ? "orbit" : "column";
    o.mode = mode;
    o.container.classList.toggle("is-orbit", mode === "orbit");
    o.container.classList.toggle("is-column", mode === "column");
    const n = o.slots.length;
    if (mode === "orbit") {
      const perRow = Math.max(1, Math.ceil(n / 2));
      o.cardW = clamp(Math.floor(((0.86 * width) / perRow) * 0.93), 170, 236);
      o.slots.forEach((slot) => {
        slot.style.width = `${o.cardW}px`;
      });
      o.heights = o.slots.map((slot) => slot.offsetHeight);
      o.cardH = Math.max(...o.heights);
      o.w = width;
      o.h = Math.round((o.cardH + 30 + 26) / 0.38);
      o.container.style.height = `${o.h}px`;
    } else {
      o.slots.forEach((slot) => {
        slot.style.width = "";
        slot.style.transform = "";
      });
      o.container.style.height = "";
      o.w = width;
      o.h = o.container.clientHeight;
    }
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    o.canvas.width = Math.round(o.w * ratio);
    o.canvas.height = Math.round(o.h * ratio);
    o.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  };

  const rgba = (color, alpha) => {
    const probe = rgba.ctx || (rgba.ctx = document.createElement("canvas").getContext("2d"));
    probe.fillStyle = "#000";
    probe.fillStyle = color;
    const hex = probe.fillStyle;
    if (hex.charAt(0) !== "#") return hex;
    return `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${alpha})`;
  };

  const drawOrbit = (o, t) => {
    const ctx = o.ctx;
    ctx.clearRect(0, 0, o.w, o.h);
    const n = o.slots.length;
    if (o.mode === "column") {
      // A line soaring down the left side, with a node beside each card.
      const x0 = 15;
      const pts = [];
      for (let i = 0; i <= 60; i += 1) {
        const y = (o.h * i) / 60;
        pts.push([x0 + 3 * Math.sin((y / o.h) * TAU * 1.5 + t * 0.4), y]);
      }
      ctx.strokeStyle = rgba(colors.accent, 0.5);
      ctx.lineWidth = 2;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.stroke();
      o.slots.forEach((slot) => {
        if (slot.hidden) return;
        const y = slot.offsetTop + Math.min(40, slot.offsetHeight / 2);
        const x = x0 + 3 * Math.sin((y / o.h) * TAU * 1.5 + t * 0.4);
        ctx.fillStyle = rgba(colors.accent, 1);
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = rgba(colors.accent, 0.35);
        ctx.beginPath();
        ctx.moveTo(x + 6, y);
        ctx.lineTo(34, y);
        ctx.stroke();
      });
      return;
    }
    // The path, thicker and stronger as it comes nearer, with a soft glow.
    const samples = [];
    for (let i = 0; i <= 90; i += 1) {
      const s = i / 90;
      const [x, y, d] = pathPoint(o, s, t);
      const [px, py] = parallax(o, d, t);
      samples.push([x + px, y + py, d]);
    }
    ctx.lineCap = "round";
    for (let i = 1; i < samples.length; i += 1) {
      const a = samples[i - 1];
      const b = samples[i];
      const near = (b[2] - 0.86) / 0.14;
      ctx.strokeStyle = rgba(colors.accent, 0.08 + 0.08 * near);
      ctx.lineWidth = 7 + 6 * near;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
      ctx.strokeStyle = rgba(colors.accent, 0.45 + 0.5 * near);
      ctx.lineWidth = 1.2 + 2 * near;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
    // Light travelling from the past to the present.
    if (!reduced.matches) {
      for (let k = 0; k < 7; k += 1) {
        const s = (t * 0.05 + k / 7) % 1;
        for (let j = 0; j < 8; j += 1) {
          const q = s - j * 0.006;
          if (q < 0) continue;
          const [x, y, d] = pathPoint(o, q, t);
          const [px, py] = parallax(o, d, t);
          ctx.fillStyle = rgba(colors.accent, (1 - j / 8) * 0.9 * smooth(s / 0.05) * (1 - smooth((s - 0.95) / 0.05)));
          ctx.beginPath();
          ctx.arc(x + px, y + py, (2.6 - j * 0.25) * d, 0, TAU);
          ctx.fill();
        }
      }
    }
    // Ends: the earliest year, and now.
    ctx.font = `500 11px "Geist Mono", ui-monospace, monospace`;
    ctx.fillStyle = rgba(colors.ink, 1);
    ctx.textAlign = "left";
    const first = samples[0];
    ctx.fillText(String(axisStart), Math.max(2, first[0] - 30), first[1] + 22);
    const lastPoint = samples[samples.length - 1];
    ctx.fillStyle = rgba(colors.accent, 1);
    ctx.textAlign = "right";
    ctx.fillText("now", lastPoint[0] + 24, lastPoint[1] - 14);
    ctx.beginPath();
    ctx.arc(lastPoint[0], lastPoint[1], 3 + 2 * (0.5 + 0.5 * Math.sin(t * 2.4)), 0, TAU);
    ctx.fill();

    // Cards, nodes and the threads between them.
    o.slots.forEach((slot, i) => {
      const s = (i + 0.5) / n;
      const [x, y, d] = pathPoint(o, s, t);
      const [px, py] = parallax(o, d, t);
      const above = i % 2 === 0;
      const bob = reduced.matches ? 0 : 4 * Math.sin(t * 0.9 + i * 1.7);
      const gap = 30 * d;
      const nx = x + px;
      const ny = y + py;
      // Above the line the card's bottom meets the thread; below it, its top does.
      const top = above ? ny - gap - o.heights[i] + bob : ny + gap + bob;
      slot.style.transformOrigin = above ? "50% 100%" : "50% 0%";
      slot.style.transform = `translate3d(${(nx - o.cardW / 2).toFixed(1)}px, ${top.toFixed(1)}px, 0) scale(${d.toFixed(3)})`;
      slot.style.zIndex = String(10 + Math.round(d * 10) + (o.hover === i ? 50 : 0));
      const hot = o.hover === i;
      // Thread from the node to the card's edge.
      ctx.strokeStyle = rgba(colors.accent, hot ? 0.9 : 0.4);
      ctx.lineWidth = hot ? 1.6 : 1;
      ctx.beginPath();
      ctx.moveTo(nx, ny);
      ctx.lineTo(nx, above ? ny - gap + bob : ny + gap + bob);
      ctx.stroke();
      // Node.
      ctx.fillStyle = rgba(colors.accent, 0.18);
      ctx.beginPath();
      ctx.arc(nx, ny, (hot ? 11 : 8) * d, 0, TAU);
      ctx.fill();
      ctx.fillStyle = rgba(colors.accent, 1);
      ctx.beginPath();
      ctx.arc(nx, ny, 4 * d, 0, TAU);
      ctx.fill();
      // Start year by the node.
      const span = spans.get(slot.querySelector("[data-cv-card]"));
      if (span) {
        ctx.fillStyle = rgba(colors.ink, 1);
        ctx.textAlign = "center";
        ctx.fillText(String(Math.floor(span.start)), nx, above ? ny + 20 : ny - 12);
      }
    });
  };

  /* ---------- Rings: entries and lists circling a slowly turning star ---------- */
  // Cards orbit on one tilted ring; chip lists on one ring each (the shorter list inside), the
  // rings turning in opposite directions. Hovering pauses a ring; focusing an item brings it round
  // to the front. Narrow screens and searches get a plain layout.
  const rings = Array.from(root.querySelectorAll("[data-cv-ring]")).map((container) => {
    const chips = container.classList.contains("cv-ring-chips");
    const groups = chips
      ? Array.from(container.querySelectorAll(".cv-chips")).map((group) => ({
          items: Array.from(group.querySelectorAll("li")),
          label: (group.querySelector(".cv-chips-label") || { textContent: "" }).textContent.trim(),
        }))
      : [{ items: Array.from(container.querySelectorAll(".cv-card-slot")), label: "" }];
    groups.sort((a, b) => a.items.length - b.items.length);
    const canvas = container.querySelector("canvas");
    return { container, chips, groups, canvas, ctx: canvas.getContext("2d"), mode: "", w: 0, h: 0, angle: Math.random() * TAU, speed: 1, hold: false, target: null };
  });
  const RING_PHASE = 0.45;
  const ringSpeed = (r) => (TAU / (r.chips ? 70 : 90));

  const layoutRing = (r) => {
    const width = r.container.clientWidth;
    const mode = width >= 720 && !r.container.classList.contains("is-filtered") ? "ring" : "flat";
    r.mode = mode;
    r.container.classList.toggle("is-ring", mode === "ring");
    r.container.classList.toggle("is-flat", mode === "flat");
    const items = r.groups.flatMap((g) => g.items);
    if (mode === "flat") {
      items.forEach((el) => {
        el.style.transform = "";
        el.style.zIndex = "";
        el.style.width = "";
      });
      r.container.style.height = "";
      r.w = width;
      r.h = r.container.clientHeight;
    } else {
      r.w = width;
      if (r.chips) {
        r.groups.forEach((g) => {
          g.sizes = g.items.map((el) => [el.offsetWidth, el.offsetHeight]);
        });
        const K = r.groups.length;
        r.radii = r.groups.map((g, k) => {
          const rx = width * (K === 1 ? 0.33 : 0.21 + 0.19 * k);
          return [rx, rx * 0.3];
        });
        r.h = Math.round(2 * r.radii[K - 1][1] + 96);
      } else {
        r.itemW = clamp(Math.floor(width * 0.24), 200, 240);
        items.forEach((el) => {
          el.style.width = `${r.itemW}px`;
        });
        r.groups[0].sizes = items.map((el) => [r.itemW, el.offsetHeight]);
        const rx = Math.min(width * 0.36, 400);
        r.radii = [[rx, rx * 0.3]];
        r.h = Math.round(2 * rx * 0.3 + Math.max(...r.groups[0].sizes.map((sz) => sz[1])) + 64);
      }
      r.container.style.height = `${r.h}px`;
    }
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    r.canvas.width = Math.round(r.w * ratio);
    r.canvas.height = Math.round(r.h * ratio);
    r.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  };

  // An eight-pointed star (two overlapping squares) inside a ring, turning slowly.
  const drawStar = (ctx, cx, cy, R, t) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(reduced.matches ? 0 : t * 0.1);
    const star = new Path2D();
    for (let k = 0; k < 8; k += 1) {
      const outer = (k * Math.PI) / 4;
      const inner = outer + Math.PI / 8;
      const ri = R * Math.cos(Math.PI / 4) / Math.cos(Math.PI / 8);
      if (k === 0) star.moveTo(R * Math.cos(outer), R * Math.sin(outer));
      else star.lineTo(R * Math.cos(outer), R * Math.sin(outer));
      star.lineTo(ri * Math.cos(inner), ri * Math.sin(inner));
    }
    star.closePath();
    ctx.fillStyle = rgba(colors.accent, 0.1);
    ctx.fill(star);
    ctx.strokeStyle = rgba(colors.accent, 0.85);
    ctx.lineWidth = 1.4;
    ctx.stroke(star);
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(colors.accent, 0.5);
    [0, Math.PI / 4].forEach((offset) => {
      ctx.beginPath();
      for (let k = 0; k < 4; k += 1) {
        const a = offset + (k * Math.PI) / 2;
        if (k === 0) ctx.moveTo(R * 0.62 * Math.cos(a), R * 0.62 * Math.sin(a));
        else ctx.lineTo(R * 0.62 * Math.cos(a), R * 0.62 * Math.sin(a));
      }
      ctx.closePath();
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.22, 0, TAU);
    ctx.fillStyle = rgba(colors.accent, 0.9);
    ctx.fill();
    ctx.restore();
  };

  const ringAngle = (r, k, i, n) => (k % 2 ? -1 : 1) * r.angle + (TAU * i) / n + k * RING_PHASE;

  const drawRing = (r, t) => {
    const ctx = r.ctx;
    ctx.clearRect(0, 0, r.w, r.h);
    if (r.mode !== "ring") return;
    const cx = r.w / 2;
    const cy = r.h / 2;
    ctx.font = `500 11px "Geist Mono", ui-monospace, monospace`;
    r.groups.forEach((g, k) => {
      const [rx, ry] = r.radii[k];
      // The ring: its far half fainter than its near half.
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(colors.accent, 0.22);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, TAU);
      ctx.stroke();
      ctx.strokeStyle = rgba(colors.accent, 0.55);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI);
      ctx.stroke();
      // Light running round the ring.
      if (!reduced.matches) {
        for (let j = 0; j < 10; j += 1) {
          const a = (k % 2 ? -1 : 1) * (t * 0.5) - j * 0.03;
          ctx.fillStyle = rgba(colors.accent, (1 - j / 10) * (0.45 + 0.4 * (Math.sin(a) + 1) / 2));
          ctx.beginPath();
          ctx.arc(cx + rx * Math.cos(a), cy + ry * Math.sin(a), 2.4 - j * 0.18, 0, TAU);
          ctx.fill();
        }
      }
      if (g.label) {
        ctx.fillStyle = rgba(colors.accent, 1);
        ctx.textAlign = "right";
        ctx.fillText(g.label, cx - rx - 12, cy + 4);
      }
      const n = g.items.length;
      g.items.forEach((el, i) => {
        const theta = ringAngle(r, k, i, n);
        const x = cx + rx * Math.cos(theta);
        const y = cy + ry * Math.sin(theta);
        const depth = (Math.sin(theta) + 1) / 2;
        // Spokes from the star to the near items.
        if (depth > 0.45) {
          ctx.strokeStyle = rgba(colors.accent, 0.22 * (depth - 0.45) / 0.55);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
        const [w, h] = g.sizes[i];
        const scale = r.chips ? 0.88 + 0.12 * depth : 0.8 + 0.2 * depth;
        el.style.transform = `translate3d(${(x - w / 2).toFixed(1)}px, ${(y - h / 2).toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
        el.style.zIndex = String(10 + Math.round(depth * 40));
      });
    });
    drawStar(ctx, cx, cy, r.chips ? 24 : 42, t);
  };

  const advanceRing = (r, dt) => {
    if (r.mode !== "ring") return;
    if (r.target !== null) {
      // Turn the shortest way to bring the focused item to the front.
      let diff = (r.target - r.angle) % TAU;
      if (diff > Math.PI) diff -= TAU;
      if (diff < -Math.PI) diff += TAU;
      r.angle += diff * Math.min(1, dt * 4);
      return;
    }
    r.speed += ((r.hold ? 0 : 1) - r.speed) * Math.min(1, dt * 3);
    r.angle += ringSpeed(r) * r.speed * dt;
  };
  rings.forEach((r) => {
    r.container.addEventListener("pointerenter", () => {
      r.hold = true;
    });
    r.container.addEventListener("pointerleave", () => {
      r.hold = false;
    });
    r.groups.forEach((g, k) => {
      g.items.forEach((el, i) => {
        el.addEventListener("focusin", () => {
          if (r.mode !== "ring") return;
          // theta = pi / 2 is the front of the ring.
          const sign = k % 2 ? -1 : 1;
          r.target = sign * (Math.PI / 2 - (TAU * i) / g.items.length - k * RING_PHASE);
        });
        el.addEventListener("focusout", () => {
          r.target = null;
        });
      });
    });
  });

  /* ---------- One clock for the timelines and the rings ---------- */
  let animTime = 0;
  let animLast = null;
  let animFrame = null;
  let cvPaused = false;
  const visibleScenes = new Set();
  const drawAll = () => {
    orbits.forEach((o) => drawOrbit(o, animTime));
    rings.forEach((r) => drawRing(r, animTime));
  };
  const animTick = (stamp) => {
    const dt = animLast === null ? 0 : Math.min((stamp - animLast) / 1000, 0.1);
    animLast = stamp;
    if (!cvPaused) {
      animTime += dt;
      orbits.forEach((o) => {
        // Ease the pointer so the parallax glides.
        o.pointer[0] += (o.aim[0] - o.pointer[0]) * Math.min(1, dt * 4);
        o.pointer[1] += (o.aim[1] - o.pointer[1]) * Math.min(1, dt * 4);
        if (visibleScenes.has(o.container)) drawOrbit(o, animTime);
      });
      rings.forEach((r) => {
        if (!visibleScenes.has(r.container)) return;
        advanceRing(r, dt);
        drawRing(r, animTime);
      });
    }
    animFrame = window.requestAnimationFrame(animTick);
  };
  const animSync = () => {
    if (animFrame !== null) window.cancelAnimationFrame(animFrame);
    animFrame = null;
    animLast = null;
    if (!reduced.matches && !document.hidden && visibleScenes.size) animFrame = window.requestAnimationFrame(animTick);
    else drawAll();
  };
  const relayout = () => {
    colors = palette();
    orbits.forEach((o) => layoutOrbit(o));
    rings.forEach((r) => layoutRing(r));
    drawAll();
  };
  orbits.forEach((o) => {
    o.slots.forEach((slot, i) => {
      slot.addEventListener("pointerenter", () => {
        o.hover = i;
      });
      slot.addEventListener("pointerleave", () => {
        if (o.hover === i) o.hover = -1;
      });
      slot.addEventListener("focusin", () => {
        o.hover = i;
      });
      slot.addEventListener("focusout", () => {
        if (o.hover === i) o.hover = -1;
      });
    });
    o.container.addEventListener("pointermove", (event) => {
      const box = o.container.getBoundingClientRect();
      o.aim = [((event.clientX - box.left) / box.width - 0.5) * 2, ((event.clientY - box.top) / box.height - 0.5) * 2];
    });
    o.container.addEventListener("pointerleave", () => {
      o.aim = [0, 0];
    });
  });
  const sceneContainers = [...orbits.map((o) => o.container), ...rings.map((r) => r.container)];
  if ("IntersectionObserver" in window) {
    const watcher = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visibleScenes.add(entry.target);
        else visibleScenes.delete(entry.target);
      });
      animSync();
    });
    sceneContainers.forEach((c) => watcher.observe(c));
  } else {
    sceneContainers.forEach((c) => visibleScenes.add(c));
  }
  relayout();
  animSync();
  window.addEventListener("resize", relayout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
  // Figures change card heights when they load.
  root.querySelectorAll(".cv-figure img").forEach((img) => img.addEventListener("load", relayout, { once: true }));
  document.addEventListener("visibilitychange", animSync);
  document.addEventListener("motifs:palette", () => {
    colors = palette();
    drawAll();
  });

  /* ---------- Filters and search ---------- */
  const toolbar = root.querySelector("[data-cv-toolbar]");
  const input = root.querySelector("#cv-search");
  const status = root.querySelector(".cv-search-status");
  const empty = root.querySelector(".cv-no-results");
  const filters = Array.from(root.querySelectorAll("[data-cv-filter]"));
  let section = "all";
  const normalize = (value) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const apply = () => {
    const query = normalize(input ? input.value.trim() : "");
    let shown = 0;
    sections.forEach((group) => {
      const inSection = section === "all" || group.dataset.cvSection === section;
      const titleMatches = query && normalize(group.querySelector(".cv-group-title").textContent).includes(query);
      let count = 0;
      group.querySelectorAll("[data-cv-item]").forEach((item) => {
        const match = inSection && (!query || titleMatches || normalize(item.textContent).includes(query));
        item.hidden = !match;
        if (match) count += 1;
      });
      group.hidden = !inSection || count === 0;
      shown += count;
    });
    if (empty) empty.hidden = shown > 0;
    if (status) status.textContent = query ? `${shown} matching CV ${shown === 1 ? "item" : "items"}.` : "";
    // Searching shows a plain list; the timeline returns when the search is cleared.
    sceneContainers.forEach((c) => c.classList.toggle("is-filtered", Boolean(query)));
    relayout();
  };
  filters.forEach((button) => {
    button.addEventListener("click", () => {
      section = button.dataset.cvFilter;
      filters.forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      apply();
    });
  });
  if (input) input.addEventListener("input", apply);
  if (toolbar) toolbar.hidden = false;

  /* ---------- Card view ---------- */
  const focus = root.querySelector("[data-cv-focus]");
  if (!focus || typeof focus.showModal !== "function") return;
  const panel = focus.querySelector("[data-cv-focus-panel]");
  const body = focus.querySelector("[data-cv-focus-body]");
  // Ease in and out, so the growth out of the card (and back into it) is seen.
  const EASE = "cubic-bezier(0.65, 0, 0.25, 1)";
  let current = null;
  let busy = false;

  // Only this entry: its mark or figure, title, role, dates, place, points and its own links.
  const fill = (card) => {
    const span = spans.get(card);
    const publication = card.dataset.kind === "publication";
    body.innerHTML = `
      <div class="cv-focus-head"></div>
      <p class="cv-focus-section"></p>
      <h2 id="cv-focus-title"></h2>
      <p class="cv-focus-role"></p>
      <p class="cv-focus-meta"><span class="cv-focus-when"></span><span class="cv-focus-where"></span></p>`;
    const head = body.querySelector(".cv-focus-head");
    const figure = publication && card.querySelector(".cv-figure img");
    if (figure) {
      const img = new Image();
      img.src = figure.currentSrc || figure.src;
      img.alt = figure.alt;
      head.className = "cv-focus-figure";
      head.appendChild(img);
    } else if (!publication) {
      const emblem = card.querySelector(".cv-emblem").cloneNode(true);
      emblem.querySelectorAll("img").forEach((img) => img.removeAttribute("loading"));
      head.appendChild(emblem);
    } else head.remove();
    body.querySelector(".cv-focus-section").textContent = card.dataset.section || "";
    body.querySelector("#cv-focus-title").textContent = card.querySelector(".cv-card-title").textContent;
    body.querySelector(".cv-focus-role").textContent = card.querySelector(".cv-card-role").textContent;
    const when = body.querySelector(".cv-focus-when");
    when.textContent = card.querySelector(".cv-date").textContent;
    if (span && !publication) {
      const length = document.createElement("span");
      length.className = "cv-focus-duration";
      length.textContent = span.present ? `${duration(span)} so far` : duration(span);
      when.appendChild(length);
    }
    const place = card.querySelector(".cv-place").textContent;
    body.querySelector(".cv-focus-where").textContent = place;
    // A venue such as "ICCV 2023" already carries the year.
    if (publication && place.includes(when.textContent)) when.remove();
    const details = card.querySelector(".cv-card-details");
    if (details && publication) {
      // The PDF's citation, cut to its authors (the title and venue are shown above).
      const citation = details.textContent.trim();
      const cut = citation.search(/[“”"]/);
      const authors = document.createElement("p");
      authors.className = "cv-focus-authors";
      (cut > 0 ? citation.slice(0, cut).replace(/[\s,]+$/, "") : citation).split(/(N\. Nayal)/).forEach((part) => {
        if (part === "N. Nayal") {
          const me = document.createElement("strong");
          me.textContent = part;
          authors.appendChild(me);
        } else if (part) authors.append(part);
      });
      body.appendChild(authors);
    } else if (details) {
      const points = details.cloneNode(true);
      points.className = "cv-focus-points";
      body.appendChild(points);
    }
    // Links, as stated in papers.bib for a publication, or the organisation's website.
    const links = publication
      ? [["paper", "Paper"], ["arxiv", "arXiv"], ["pdf", "PDF"], ["code", "Code"], ["website", "Project page"]].filter(([key]) => card.dataset[key]).map(([key, label]) => [card.dataset[key], label])
      : card.dataset.url
        ? [[card.dataset.url, new URL(card.dataset.url).hostname.replace(/^www\./, "")]]
        : [];
    if (links.length) {
      const row = document.createElement("p");
      row.className = "cv-focus-links";
      links.forEach(([href, label]) => {
        const a = document.createElement("a");
        a.href = href;
        a.textContent = `${label} ↗`;
        row.appendChild(a);
      });
      body.appendChild(row);
    }
    body.scrollTop = 0;
  };

  // The panel drawn as the card: moved onto the card's centre and clipped to the card's size.
  const asCard = (card) => {
    const c = card.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    const x = Math.max(0, (p.width - c.width) / 2);
    const y = Math.max(0, (p.height - c.height) / 2);
    const dx = c.left + c.width / 2 - (p.left + p.width / 2);
    const dy = c.top + c.height / 2 - (p.top + p.height / 2);
    return {
      transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`,
      clipPath: `inset(${y.toFixed(1)}px ${x.toFixed(1)}px round 12px)`,
    };
  };
  const OPEN = { transform: "translate(0px, 0px)", clipPath: "inset(0px 0px round 16px)" };

  const lift = (card, on) => {
    const slot = card.closest(".cv-card-slot");
    card.classList.toggle("is-lifted", on);
    if (slot) slot.classList.toggle("is-lifted", on);
  };

  const show = (card) => {
    if (busy) return;
    cvPaused = true;
    current = card;
    fill(card);
    focus.showModal();
    if (reduced.matches) {
      focus.classList.add("is-open", "is-shown");
      return;
    }
    busy = true;
    focus.classList.remove("is-shown");
    // Measuring settles the dialog's first style, so the page then dims with a transition.
    const from = asCard(card);
    focus.classList.add("is-open");
    lift(card, true);
    const grow = panel.animate([from, OPEN], { duration: 620, easing: EASE });
    window.setTimeout(() => focus.classList.add("is-shown"), 380);
    grow.onfinish = () => {
      busy = false;
    };
  };

  const hide = () => {
    if (busy || !focus.open) return;
    const card = current;
    const done = () => {
      focus.close();
      focus.classList.remove("is-shown");
      if (card) {
        lift(card, false);
        const button = card.querySelector("[data-cv-open]");
        if (button) button.focus({ preventScroll: true });
      }
      busy = false;
      cvPaused = false;
    };
    focus.classList.remove("is-open");
    if (reduced.matches || !card) {
      done();
      return;
    }
    busy = true;
    // Bring the card on screen behind the panel, so the panel can return into it.
    const box = card.getBoundingClientRect();
    if (box.bottom < 0 || box.top > window.innerHeight) card.scrollIntoView({ block: "center", behavior: "instant" });
    focus.classList.remove("is-shown");
    window.setTimeout(() => {
      const shrink = panel.animate([OPEN, asCard(card)], { duration: 520, easing: EASE, fill: "forwards" });
      shrink.onfinish = () => {
        done();
        shrink.cancel();
      };
    }, 120);
  };

  cards.forEach((card) => {
    const button = card.querySelector("[data-cv-open]");
    if (!button) return;
    button.hidden = false;
    button.addEventListener("click", () => show(card));
  });
  focus.querySelector("[data-cv-close]").addEventListener("click", hide);
  // A click on the dimmed page around the card closes it.
  focus.addEventListener("click", (event) => {
    if (event.target === focus) hide();
  });
  focus.addEventListener("cancel", (event) => {
    event.preventDefault();
    hide();
  });
})();
