/* Research motifs: small canvas animations about generative modeling and world models.
 * Each motif is a pure function of time, so it can render any moment as a still frame.
 * Motifs read the theme palette, pause off-screen or in hidden tabs, offer a pause control,
 * and draw one still frame when reduced motion is requested. */
(() => {
  "use strict";

  const TAU = Math.PI * 2;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const root = document.documentElement;
  const MONO = '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  };
  const ease = (t) => {
    t = clamp(t, 0, 1);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };
  // Seeded generator (mulberry32), so every cycle of a motif is reproducible.
  const seeded = (seed) => {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const gauss = (random) => {
    let u = 0;
    while (u === 0) u = random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * random());
  };
  const normal = (x, mean, sd) => Math.exp(-0.5 * Math.pow((x - mean) / sd, 2)) / (sd * Math.sqrt(TAU));

  // Palette, read from the site's CSS custom properties.
  const probe = document.createElement("canvas").getContext("2d");
  const toRgb = (value) => {
    probe.fillStyle = "#000";
    probe.fillStyle = value;
    const parsed = probe.fillStyle;
    if (parsed.charAt(0) === "#") {
      return [parseInt(parsed.slice(1, 3), 16), parseInt(parsed.slice(3, 5), 16), parseInt(parsed.slice(5, 7), 16)];
    }
    const parts = parsed.match(/[\d.]+/g) || [0, 0, 0];
    return [+parts[0], +parts[1], +parts[2]];
  };
  const palette = {};
  const readPalette = () => {
    const style = getComputedStyle(root);
    const read = (name, fallback) => toRgb(style.getPropertyValue(name).trim() || fallback);
    palette.accent = read("--global-theme-color", "#087f83");
    palette.ink = read("--global-text-color", "#23332e");
    palette.rule = read("--global-divider-color", "#d9e1db");
    palette.soft = read("--editorial-accent-soft", "#e4f2f0");
    palette.dark = root.getAttribute("data-theme") === "dark";
  };
  const rgba = (rgb, alpha) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha === undefined ? 1 : alpha})`;

  // Drawing helpers. Labels always use the full text or accent color.
  const roundRect = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  const label = (ctx, text, x, y, align, rgb) => {
    ctx.font = `500 10px ${MONO}`;
    ctx.textAlign = align || "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = rgba(rgb || palette.ink);
    ctx.fillText(text, x, y);
  };
  const polyline = (ctx, points) => {
    ctx.beginPath();
    for (let i = 0; i < points.length; i += 2) {
      if (i === 0) ctx.moveTo(points[i], points[i + 1]);
      else ctx.lineTo(points[i], points[i + 1]);
    }
  };

  const wide = window.matchMedia("(min-width: 768px)");
  const motifs = {};
  const define = (name, setup) => {
    motifs[name] = setup;
  };

  /* Publications: MixFlow. Particles travel from a source distribution to a three-mode
   * data distribution. As the mixing weight w grows, the source aligns with the data and
   * the generative paths straighten. */
  define("mixflow", (view) => {
    const ctx = view.ctx;
    const MODES = [-1.65, 0.3, 1.8];
    const SPREAD = [0.2, 0.16, 0.24];
    const MEAN = (MODES[0] + MODES[1] + MODES[2]) / 3;
    const LIFE = 5.2;
    const CYCLE = 18;
    const random = seeded(42);
    const particles = [];
    for (let i = 0; i < 66; i += 1) {
      particles.push({ k: i % 3, z: gauss(random), z1: gauss(random), offset: (i / 66) * LIFE + random() * 0.4 });
    }
    const weight = (time) => 0.5 - 0.5 * Math.cos((TAU * time) / CYCLE);
    const sourceMean = (k, w) => w * MODES[k] * 0.92;
    const sourceSd = (w) => (1 - w) + w * 0.32;
    const pathAt = (x0, x1, w, s) => {
      const control = lerp((x0 + x1) / 2, MEAN, 0.9 * (1 - w));
      return (1 - s) * (1 - s) * x0 + 2 * (1 - s) * s * control + s * s * x1;
    };

    const draw = (t) => {
      const density = 26;
      const left = density + 8;
      const right = view.w - density - 8;
      const top = 16;
      const bottom = view.h - 16;
      const middle = (top + bottom) / 2;
      const scale = (bottom - top) / 5.6;
      const X = (s) => lerp(left, right, s);
      const Y = (v) => middle - v * scale;
      const w = weight(t);

      // Reference paths at the current weight show the curvature directly.
      ctx.strokeStyle = rgba(palette.rule);
      ctx.lineWidth = 1;
      for (let k = 0; k < 3; k += 1) {
        [-1, 0, 1].forEach((z) => {
          const x0 = sourceMean(k, w) + sourceSd(w) * z;
          const x1 = MODES[k] + SPREAD[k] * z;
          const points = [];
          for (let i = 0; i <= 24; i += 1) points.push(X(i / 24), Y(pathAt(x0, x1, w, i / 24)));
          polyline(ctx, points);
          ctx.stroke();
        });
      }

      // Source density (left, changes with w) and data density (right).
      const curve = (side, pdf) => {
        const edge = side < 0 ? left - 4 : right + 4;
        let peak = 0;
        const values = [];
        for (let i = 0; i <= 60; i += 1) {
          const v = -2.8 + (5.6 * i) / 60;
          const p = pdf(v);
          values.push([v, p]);
          peak = Math.max(peak, p);
        }
        ctx.beginPath();
        ctx.moveTo(edge, Y(values[0][0]));
        values.forEach(([v, p]) => ctx.lineTo(edge + side * (p / peak) * density, Y(v)));
        ctx.lineTo(edge, Y(values[values.length - 1][0]));
        ctx.closePath();
        ctx.fillStyle = rgba(palette.accent, 0.14);
        ctx.fill();
        ctx.strokeStyle = rgba(palette.accent, 0.75);
        ctx.lineWidth = 1;
        ctx.stroke();
      };
      curve(-1, (v) => (normal(v, sourceMean(0, w), sourceSd(w)) + normal(v, sourceMean(1, w), sourceSd(w)) + normal(v, sourceMean(2, w), sourceSd(w))) / 3);
      curve(1, (v) => (normal(v, MODES[0], SPREAD[0]) + normal(v, MODES[1], SPREAD[1]) + normal(v, MODES[2], SPREAD[2])) / 3);

      particles.forEach((p) => {
        const age = (((t + p.offset) % LIFE) + LIFE) % LIFE;
        const s = age / LIFE;
        const born = weight(t - age);
        const x0 = sourceMean(p.k, born) + sourceSd(born) * p.z;
        const x1 = MODES[p.k] + SPREAD[p.k] * p.z1;
        const fade = smooth(s / 0.06) * (1 - smooth((s - 0.94) / 0.06));
        const trail = [];
        for (let i = 0; i <= 6; i += 1) {
          const q = Math.max(0, s - 0.16 + (0.16 * i) / 6);
          trail.push(X(q), Y(pathAt(x0, x1, born, q)));
        }
        ctx.strokeStyle = rgba(palette.accent, 0.35 * fade);
        ctx.lineWidth = 1;
        polyline(ctx, trail);
        ctx.stroke();
        ctx.fillStyle = rgba(palette.accent, fade);
        ctx.beginPath();
        ctx.arc(X(s), Y(pathAt(x0, x1, born, s)), 1.7, 0, TAU);
        ctx.fill();
      });

      label(ctx, `w = ${w.toFixed(2)}`, 2, 10);
      label(ctx, "source", 2, view.h - 2);
      label(ctx, "data", view.w - 2, view.h - 2, "right");
    };
    return { draw, still: CYCLE * 0.3 };
  });

  /* Planning by diffusion, shared by the Projects figure and the home backdrop: candidate
   * trajectories between a fixed start and goal in a 1.8 x 1 box with three obstacles. */
  const PLAN = {
    BOX: 1.8,
    START: [0.12, 0.76],
    GOAL: [1.68, 0.24],
    OBSTACLES: [[0.62, 0.44, 0.17], [1.08, 0.7, 0.15], [1.24, 0.22, 0.1]],
    PLANS: 5,
    STEPS: 28,
  };
  const planCache = new Map();
  const planBatch = (c) => {
    if (planCache.has(c)) return planCache.get(c);
    const { START, GOAL, OBSTACLES, PLANS, STEPS } = PLAN;
    const random = seeded(c * 131 + 7);
    const plans = [];
    for (let j = 0; j < PLANS; j += 1) {
      const lift = (j / (PLANS - 1) - 0.5) * 1.1 + (random() - 0.5) * 0.25;
      const c1 = [START[0] + 0.45, START[1] - lift];
      const c2 = [GOAL[0] - 0.45, GOAL[1] - lift * 0.6];
      const points = [];
      for (let p = 0; p < STEPS; p += 1) {
        const s = p / (STEPS - 1);
        const u = 1 - s;
        points.push([
          u * u * u * START[0] + 3 * u * u * s * c1[0] + 3 * u * s * s * c2[0] + s * s * s * GOAL[0],
          u * u * u * START[1] + 3 * u * u * s * c1[1] + 3 * u * s * s * c2[1] + s * s * s * GOAL[1],
        ]);
      }
      for (let pass = 0; pass < 8; pass += 1) {
        for (let p = 1; p < STEPS - 1; p += 1) {
          points[p][0] = (points[p - 1][0] + 2 * points[p][0] + points[p + 1][0]) / 4;
          points[p][1] = (points[p - 1][1] + 2 * points[p][1] + points[p + 1][1]) / 4;
        }
        for (let p = 1; p < STEPS - 1; p += 1) {
          OBSTACLES.forEach((o) => {
            const dx = points[p][0] - o[0];
            const dy = points[p][1] - o[1];
            const d = Math.hypot(dx, dy) || 1e-6;
            const need = o[2] + 0.035;
            if (d < need) {
              points[p][0] = o[0] + (dx / d) * need;
              points[p][1] = o[1] + (dy / d) * need;
            }
          });
          points[p][1] = clamp(points[p][1], 0.04, 0.96);
        }
      }
      let length = 0;
      for (let p = 1; p < STEPS; p += 1) length += Math.hypot(points[p][0] - points[p - 1][0], points[p][1] - points[p - 1][1]);
      // White noise per waypoint, lightly smoothed along the path, pinned at start and goal.
      const raw = points.map(() => [gauss(random) * 0.16, gauss(random) * 0.16]);
      const noise = raw.map((n, p) => {
        if (p === 0 || p === STEPS - 1) return [0, 0];
        const a = raw[p - 1];
        const b = raw[p + 1];
        return [(a[0] + 2 * n[0] + b[0]) / 3, (a[1] + 2 * n[1] + b[1]) / 3];
      });
      plans.push({ points, noise, length });
    }
    let best = 0;
    plans.forEach((plan, j) => {
      if (plan.length < plans[best].length) best = j;
    });
    const value = { plans, best };
    planCache.set(c, value);
    if (planCache.size > 6) planCache.delete(planCache.keys().next().value);
    return value;
  };

  /* Projects: planning by diffusion. Candidate trajectories between a fixed start and goal
   * are denoised together; the shortest collision-free plan is executed, then the next
   * batch of plans is sampled. */
  define("plan", (view) => {
    const ctx = view.ctx;
    const { BOX, START, GOAL, OBSTACLES } = PLAN;
    const CYCLE = 7.5;
    const batch = planBatch;

    const draw = (t) => {
      const pad = 8;
      const unit = Math.min((view.w - 2 * pad) / BOX, view.h - 2 * pad - 4);
      const ox = (view.w - unit * BOX) / 2;
      const oy = (view.h - unit) / 2;
      const X = (u) => ox + u * unit;
      const Y = (v) => oy + v * unit;
      const c = Math.floor(t / CYCLE);
      const phase = t / CYCLE - c;
      const sigma = phase < 0.5 ? Math.pow(1 - phase / 0.5, 2) : 0;
      const select = smooth((phase - 0.5) / 0.08);
      const travel = ease((phase - 0.58) / 0.3);
      const alpha = smooth(phase / 0.05) * (1 - smooth((phase - 0.93) / 0.07));
      const { plans, best } = batch(c);

      OBSTACLES.forEach((o) => {
        ctx.beginPath();
        ctx.arc(X(o[0]), Y(o[1]), o[2] * unit, 0, TAU);
        ctx.fillStyle = rgba(palette.soft);
        ctx.fill();
        ctx.strokeStyle = rgba(palette.rule);
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      plans.forEach((plan, j) => {
        const chosen = j === best;
        const points = [];
        plan.points.forEach((p, i) => points.push(X(clamp(p[0] + sigma * plan.noise[i][0], 0, BOX)), Y(clamp(p[1] + sigma * plan.noise[i][1], 0, 1))));
        ctx.strokeStyle = rgba(palette.accent, alpha * lerp(0.5, chosen ? 1 : 0.14, select));
        ctx.lineWidth = chosen ? lerp(1, 1.8, select) : 1;
        polyline(ctx, points);
        ctx.stroke();
        if (sigma > 0.02) {
          ctx.fillStyle = rgba(palette.accent, alpha * (0.25 + 0.5 * sigma));
          ctx.beginPath();
          for (let i = 0; i < points.length; i += 2) {
            ctx.moveTo(points[i] + 1.4, points[i + 1]);
            ctx.arc(points[i], points[i + 1], 1.4, 0, TAU);
          }
          ctx.fill();
        }
      });

      if (travel > 0) {
        const route = plans[best].points;
        const lengths = [0];
        for (let i = 1; i < route.length; i += 1) lengths.push(lengths[i - 1] + Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]));
        const target = travel * lengths[lengths.length - 1];
        let i = 1;
        while (i < route.length - 1 && lengths[i] < target) i += 1;
        const f = (target - lengths[i - 1]) / Math.max(1e-6, lengths[i] - lengths[i - 1]);
        const ax = X(lerp(route[i - 1][0], route[i][0], f));
        const ay = Y(lerp(route[i - 1][1], route[i][1], f));
        ctx.fillStyle = rgba(palette.accent, 0.18 * alpha);
        ctx.beginPath();
        ctx.arc(ax, ay, 8, 0, TAU);
        ctx.fill();
        ctx.fillStyle = rgba(palette.accent, alpha);
        ctx.beginPath();
        ctx.arc(ax, ay, 3.4, 0, TAU);
        ctx.fill();
      }

      ctx.strokeStyle = rgba(palette.ink);
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.arc(X(START[0]), Y(START[1]), 4, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = rgba(palette.accent);
      ctx.beginPath();
      ctx.arc(X(GOAL[0]), Y(GOAL[1]), 5.5, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = rgba(palette.accent);
      ctx.beginPath();
      ctx.arc(X(GOAL[0]), Y(GOAL[1]), 2, 0, TAU);
      ctx.fill();
      label(ctx, "start", X(START[0]) - 4, Y(START[1]) + 17);
      label(ctx, "goal", X(GOAL[0]) + 4, Y(GOAL[1]) - 11, "right");
    };
    return { draw, still: CYCLE * 0.7 };
  });

  /* Blog ("The paths"): sample paths of a reverse diffusion. Each starts as noise on the
   * left and settles into one of three modes on the right, fading behind the title. */
  define("paths", (view) => {
    const ctx = view.ctx;
    const PATHS = 30;
    const POINTS = 64;
    const MODES = [-0.52, 0.02, 0.5];
    const slotRandom = seeded(7);
    const slots = [];
    for (let j = 0; j < PATHS; j += 1) slots.push({ period: 8 + slotRandom() * 5, offset: slotRandom() * 13 });
    const cache = new Map();
    const sample = (j, c) => {
      const key = `${j}:${c}`;
      if (cache.has(key)) return cache.get(key);
      const random = seeded(j * 977 + c * 131 + 3);
      const start = clamp(gauss(random) * 0.42, -0.95, 0.95);
      const mode = MODES[Math.floor(random() * 3)] + gauss(random) * 0.03;
      const walk = [0];
      for (let i = 1; i < POINTS; i += 1) walk.push(walk[i - 1] + gauss(random) * Math.sqrt(1 / POINTS));
      const end = walk[POINTS - 1];
      const values = new Float32Array(POINTS);
      for (let i = 0; i < POINTS; i += 1) {
        const s = i / (POINTS - 1);
        const bridge = walk[i] - s * end;
        values[i] = (1 - s) * start + s * mode + 0.5 * bridge * Math.sqrt(1 - s);
      }
      cache.set(key, values);
      if (cache.size > PATHS * 3) cache.delete(cache.keys().next().value);
      return values;
    };

    const draw = (t) => {
      const cx = view.w / 2;
      const cy = view.h / 2;
      const rx = Math.min(view.w * 0.32, 330);
      const ry = view.h * 0.34;
      const X = (s) => -0.02 * view.w + s * 1.04 * view.w;
      const Y = (v) => cy + v * view.h * 0.42;
      const veil = (x, y) => {
        const d = Math.pow((x - cx) / rx, 2) + Math.pow((y - cy) / ry, 2);
        return clamp((d - 0.55) / 0.7, 0.08, 1);
      };
      ctx.lineWidth = 1;
      slots.forEach((slot, j) => {
        const clock = t + slot.offset;
        const c = Math.floor(clock / slot.period);
        const phase = clock / slot.period - c;
        const values = sample(j, c);
        const head = ease(phase / 0.72);
        const tail = Math.max(0, head - 0.5);
        const fade = smooth(phase / 0.08) * (1 - smooth((phase - 0.8) / 0.2));
        if (fade <= 0) return;
        const from = Math.floor(tail * (POINTS - 1));
        const to = Math.min(POINTS - 1, Math.ceil(head * (POINTS - 1)));
        for (let i = from; i < to; i += 1) {
          const s0 = i / (POINTS - 1);
          const x0 = X(s0);
          const y0 = Y(values[i]);
          const x1 = X((i + 1) / (POINTS - 1));
          const y1 = Y(values[i + 1]);
          const along = (s0 - tail) / Math.max(0.01, head - tail);
          ctx.strokeStyle = rgba(palette.accent, 0.42 * fade * along * veil(x0, y0));
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        }
        const hx = X(to / (POINTS - 1));
        const hy = Y(values[to]);
        ctx.fillStyle = rgba(palette.accent, 0.8 * fade * veil(hx, hy));
        ctx.beginPath();
        ctx.arc(hx, hy, 1.6, 0, TAU);
        ctx.fill();
      });
    };
    return { draw, still: 6 };
  });

  /* CV: a halftone portrait sampled from noise. Light theme draws darkness as dots,
   * dark theme draws brightness, so the face reads naturally in both. */
  define("portrait", (view) => {
    const ctx = view.ctx;
    const cols = +view.data.cols;
    const rows = +view.data.rows;
    const lum = view.data.luminance || "";
    const weight = view.data.weight || "";
    const count = cols * rows;
    if (!cols || !rows || lum.length !== count || weight.length !== count) return { draw: () => {}, still: 0 };
    const luminance = new Float32Array(count);
    const mask = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      luminance[i] = parseInt(lum.charAt(i), 16) / 15;
      mask[i] = parseInt(weight.charAt(i), 16) / 15;
    }
    const CYCLE = 10;
    const cache = new Map();
    const noise = (c) => {
      if (cache.has(c)) return cache.get(c);
      const random = seeded(c * 613 + 29);
      const values = new Float32Array(count * 3);
      for (let i = 0; i < count; i += 1) {
        values[3 * i] = clamp(0.45 + 0.3 * gauss(random), 0, 1);
        values[3 * i + 1] = gauss(random);
        values[3 * i + 2] = gauss(random);
      }
      cache.set(c, values);
      if (cache.size > 3) cache.delete(cache.keys().next().value);
      return values;
    };

    const draw = (t) => {
      const c = Math.floor(t / CYCLE);
      const phase = t / CYCLE - c;
      let sigma = 0;
      let eps = noise(c);
      if (phase < 0.42) sigma = 1 - ease(phase / 0.42);
      else if (phase > 0.84) {
        sigma = ease((phase - 0.84) / 0.16);
        eps = noise(c + 1);
      }
      const cell = Math.min(view.w / cols, (view.h - 16) / rows);
      const ox = (view.w - cell * cols) / 2;
      const oy = (view.h - 16 - cell * rows) / 2;
      ctx.fillStyle = rgba(palette.accent);
      ctx.beginPath();
      for (let i = 0; i < count; i += 1) {
        const clean = (palette.dark ? luminance[i] : 1 - luminance[i]) * mask[i];
        const value = lerp(clean, eps[3 * i], sigma);
        const radius = cell * 0.56 * Math.pow(value, 0.7);
        if (radius < 0.35) continue;
        const x = ox + ((i % cols) + 0.5) * cell + sigma * eps[3 * i + 1] * cell * 1.6;
        const y = oy + (Math.floor(i / cols) + 0.5) * cell + sigma * eps[3 * i + 2] * cell * 1.6;
        ctx.moveTo(x + radius, y);
        ctx.arc(x, y, radius, 0, TAU);
      }
      ctx.fill();
      label(ctx, `σ = ${sigma.toFixed(2)}`, ox, view.h - 2);
    };
    return { draw, still: CYCLE * 0.6 };
  });

  /* News: a world model forecasts. The past is observed; from "now" the model samples a
   * fan of possible futures whose spread grows with the horizon. */
  define("forecast", (view) => {
    const ctx = view.ctx;
    const SAMPLES = 14;
    const random = seeded(11);
    const samples = [];
    for (let j = 0; j < SAMPLES; j += 1) {
      samples.push([0, 1, 2].map((m) => ({
        amp: (0.5 + random()) * [0.5, 0.3, 0.16][m],
        freq: [0.55, 1.3, 2.6][m] * (0.8 + 0.4 * random()),
        phase: random() * TAU,
        drift: 0.15 + 0.25 * random(),
      })));
    }
    const signal = (s) => 0.55 * Math.sin(0.9 * s) + 0.28 * Math.sin(2.1 * s + 1) + 0.14 * Math.sin(3.7 * s + 2.2);

    const draw = (t) => {
      const bottom = view.h - 4;
      const middle = bottom / 2 + 6;
      const amp = bottom * 0.3;
      const now = view.w * 0.6;
      const unit = view.w / 7;
      const present = t * 0.55;
      const Y = (v) => middle - v * amp;
      const sAt = (x) => present + (x - now) / unit;

      ctx.strokeStyle = rgba(palette.rule);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, middle + 0.5);
      ctx.lineTo(view.w, middle + 0.5);
      ctx.stroke();

      const horizon = (view.w - now) / unit;
      const futures = samples.map((parts, j) => {
        const points = [];
        for (let h = 0; h <= horizon + 0.05; h += 0.08) {
          let deviation = 0;
          parts.forEach((p) => {
            deviation += p.amp * Math.sin(p.freq * h + p.phase + p.drift * t + j);
          });
          const spread = Math.pow(h / horizon, 0.9);
          points.push(now + h * unit, Y(signal(present + h) * (1 - 0.35 * spread) + deviation * spread * 0.9));
        }
        return points;
      });
      ctx.beginPath();
      for (let i = 0; i < futures[0].length; i += 2) {
        let top = Infinity;
        futures.forEach((f) => {
          top = Math.min(top, f[i + 1]);
        });
        if (i === 0) ctx.moveTo(futures[0][i], top);
        else ctx.lineTo(futures[0][i], top);
      }
      for (let i = futures[0].length - 2; i >= 0; i -= 2) {
        let low = -Infinity;
        futures.forEach((f) => {
          low = Math.max(low, f[i + 1]);
        });
        ctx.lineTo(futures[0][i], low);
      }
      ctx.closePath();
      ctx.fillStyle = rgba(palette.accent, 0.1);
      ctx.fill();
      ctx.strokeStyle = rgba(palette.accent, 0.38);
      ctx.lineWidth = 1;
      futures.forEach((f) => {
        polyline(ctx, f);
        ctx.stroke();
      });

      const past = [];
      for (let x = 0; x <= now; x += 3) past.push(x, Y(signal(sAt(x))));
      past.push(now, Y(signal(present)));
      ctx.strokeStyle = rgba(palette.ink);
      ctx.lineWidth = 1.4;
      polyline(ctx, past);
      ctx.stroke();
      ctx.fillStyle = rgba(palette.ink);
      ctx.beginPath();
      for (let s = Math.ceil(sAt(0) * 2) / 2; s <= present; s += 0.5) {
        const x = now + (s - present) * unit;
        ctx.moveTo(x + 1.8, Y(signal(s)));
        ctx.arc(x, Y(signal(s)), 1.8, 0, TAU);
      }
      ctx.fill();

      ctx.strokeStyle = rgba(palette.accent);
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(now + 0.5, 14);
      ctx.lineTo(now + 0.5, bottom);
      ctx.stroke();
      label(ctx, "now", now, 10, "center", palette.accent);
    };
    return { draw, still: 3 };
  });

  /* Project pages: a rectified flow on a classic two-dimensional toy dataset. Each point
   * moves on a straight line from Gaussian noise to data. */
  define("toy", (view) => {
    const ctx = view.ctx;
    const NAMES = ["two moons", "rings", "spiral", "checkerboard", "eight gaussians"];
    const variant = Math.abs(parseInt(view.data.variant || "0", 10) || 0) % NAMES.length;
    const COUNT = 200;
    const CYCLE = 8;
    const random = seeded(17 + variant);
    const targets = [];
    for (let i = 0; i < COUNT; i += 1) {
      let x = 0;
      let y = 0;
      if (variant === 0) {
        const a = Math.PI * random();
        if (i % 2) {
          x = Math.cos(a) - 0.5;
          y = Math.sin(a) - 0.25;
        } else {
          x = 0.5 - Math.cos(a);
          y = 0.25 - Math.sin(a);
        }
        x *= 0.62;
        y *= 0.62;
      } else if (variant === 1) {
        const a = TAU * random();
        const r = i % 2 ? 0.82 : 0.38;
        x = r * Math.cos(a);
        y = r * Math.sin(a);
      } else if (variant === 2) {
        const s = Math.sqrt(random());
        const a = 3 * Math.PI * s;
        x = 0.9 * s * Math.cos(a);
        y = 0.9 * s * Math.sin(a);
      } else if (variant === 3) {
        let cx = 0;
        let cy = 0;
        do {
          cx = Math.floor(random() * 4);
          cy = Math.floor(random() * 4);
        } while ((cx + cy) % 2);
        x = -0.9 + (cx + random()) * 0.45;
        y = -0.9 + (cy + random()) * 0.45;
      } else {
        const a = (TAU * (i % 8)) / 8;
        x = 0.78 * Math.cos(a);
        y = 0.78 * Math.sin(a);
      }
      targets.push(x + gauss(random) * 0.035, y + gauss(random) * 0.035);
    }
    const cache = new Map();
    const sources = (c) => {
      if (cache.has(c)) return cache.get(c);
      const r = seeded(c * 389 + 13);
      const values = new Float32Array(COUNT * 2);
      for (let i = 0; i < COUNT * 2; i += 1) values[i] = gauss(r) * 0.42;
      cache.set(c, values);
      if (cache.size > 3) cache.delete(cache.keys().next().value);
      return values;
    };

    const draw = (t) => {
      const c = Math.floor(t / CYCLE);
      const phase = t / CYCLE - c;
      const s = phase < 0.12 ? 0 : phase < 0.6 ? ease((phase - 0.12) / 0.48) : 1;
      const alpha = smooth(phase / 0.06) * (1 - smooth((phase - 0.88) / 0.12));
      const side = Math.min(view.w, view.h - 16);
      const ox = wide.matches ? view.w - side : 0;
      const oy = (view.h - 16 - side) / 2;
      const X = (u) => ox + ((u + 1.15) / 2.3) * side;
      const Y = (v) => oy + ((1.15 - v) / 2.3) * side;
      const z = sources(c);
      ctx.strokeStyle = rgba(palette.rule, 0.8 * alpha);
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      for (let i = 0; i < COUNT; i += 2) {
        ctx.moveTo(X(z[2 * i]), Y(z[2 * i + 1]));
        ctx.lineTo(X(lerp(z[2 * i], targets[2 * i], s)), Y(lerp(z[2 * i + 1], targets[2 * i + 1], s)));
      }
      ctx.stroke();
      ctx.fillStyle = rgba(palette.accent, alpha);
      ctx.beginPath();
      for (let i = 0; i < COUNT; i += 1) {
        const x = X(lerp(z[2 * i], targets[2 * i], s));
        const y = Y(lerp(z[2 * i + 1], targets[2 * i + 1], s));
        ctx.moveTo(x + 1.5, y);
        ctx.arc(x, y, 1.5, 0, TAU);
      }
      ctx.fill();
      label(ctx, `t = ${s.toFixed(2)}`, ox, view.h - 2);
      label(ctx, NAMES[variant], ox + side, view.h - 2, "right");
    };
    return { draw, still: CYCLE * 0.7 };
  });

  /* 404: this page is out of distribution. Site pages form a density; the missing page sits
   * far away, and its log-density is computed from the same mixture. */
  define("ood", (view) => {
    const ctx = view.ctx;
    // Positions are fractions of the width (x) and height (y); spreads are in units of height.
    const PARTS = [
      { x: 0.28, y: 0.56, s: 0.13 },
      { x: 0.42, y: 0.4, s: 0.11 },
    ];
    const random = seeded(404);
    const points = [];
    for (let i = 0; i < 170; i += 1) {
      const part = PARTS[i % 2];
      points.push({ part, dx: gauss(random), dy: gauss(random), rate: 0.6 + random(), phase: random() * TAU });
    }

    const draw = (t) => {
      const h = view.h;
      const X = (u) => u * view.w;
      const Y = (v) => v * h;
      // Isotropic Gaussian mixture density at a pixel position, in units of canvas height.
      const logDensity = (px, py) => {
        let p = 0;
        PARTS.forEach((part) => {
          p += 0.5 * normal((px - X(part.x)) / h, 0, part.s) * normal((py - Y(part.y)) / h, 0, part.s);
        });
        return Math.log(Math.max(p, 1e-300));
      };
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = rgba(palette.rule);
      ctx.lineWidth = 1;
      PARTS.forEach((part) => {
        [1, 2, 3].forEach((k) => {
          ctx.beginPath();
          ctx.arc(X(part.x), Y(part.y), part.s * k * h, 0, TAU);
          ctx.stroke();
        });
      });
      ctx.setLineDash([]);
      ctx.fillStyle = rgba(palette.ink, 0.55);
      ctx.beginPath();
      points.forEach((p) => {
        const x = X(p.part.x) + (p.dx * p.part.s + 0.006 * Math.sin(t * p.rate + p.phase)) * h;
        const y = Y(p.part.y) + (p.dy * p.part.s + 0.006 * Math.cos(t * p.rate * 0.8 + p.phase)) * h;
        ctx.moveTo(x + 1.6, y);
        ctx.arc(x, y, 1.6, 0, TAU);
      });
      ctx.fill();

      const ux = X(0.84 + 0.01 * Math.sin(0.7 * t));
      const uy = Y(0.3 + 0.03 * Math.sin(0.5 * t));
      const nearest = PARTS[1];
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = rgba(palette.accent, 0.7);
      ctx.beginPath();
      ctx.moveTo(X(nearest.x), Y(nearest.y));
      ctx.lineTo(ux, uy);
      ctx.stroke();
      ctx.setLineDash([]);
      const pulse = (t % 2.4) / 2.4;
      ctx.strokeStyle = rgba(palette.accent, 1 - pulse);
      ctx.beginPath();
      ctx.arc(ux, uy, 5 + 16 * pulse, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = rgba(palette.accent);
      ctx.beginPath();
      ctx.arc(ux, uy, 4.5, 0, TAU);
      ctx.fill();
      const score = logDensity(ux, uy);
      const align = ux > view.w - 70 ? "right" : "center";
      const lx = align === "right" ? view.w - 2 : ux;
      label(ctx, "this page", lx, uy + 26, align, palette.accent);
      label(ctx, `log p(x) = ${score < 0 ? "−" : ""}${Math.abs(score).toFixed(1)}`, lx, uy + 40, align);
      label(ctx, "pages that exist", X(PARTS[0].x), Math.min(h - 3, Y(PARTS[0].y) + PARTS[0].s * 3 * h + 14), "center");
    };
    return { draw, still: 1.2 };
  });

  const running = [];
  const mount = (figure) => {
    const setup = motifs[figure.dataset.motif];
    const canvas = figure.querySelector("canvas");
    if (!setup || !canvas || !canvas.getContext) return;
    const ctx = canvas.getContext("2d");
    const toggle = figure.querySelector(".motif-toggle");
    const view = { ctx, w: 0, h: 0, figure, data: figure.dataset };
    const motif = setup(view);
    let time = 0;
    let last = null;
    let frame = null;
    let paused = false;
    let visible = true;

    const paint = () => {
      if (!view.w) return;
      ctx.clearRect(0, 0, view.w, view.h);
      motif.draw(reduced.matches ? motif.still : motif.still + time);
    };
    const resize = () => {
      const box = canvas.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      view.w = box.width;
      view.h = box.height;
      canvas.width = Math.round(box.width * ratio);
      canvas.height = Math.round(box.height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (motif.resize) motif.resize();
      paint();
    };
    const tick = (now) => {
      if (last !== null) time += Math.min((now - last) / 1000, 0.05);
      last = now;
      paint();
      frame = window.requestAnimationFrame(tick);
    };
    const sync = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
      last = null;
      if (toggle) toggle.hidden = reduced.matches;
      if (!reduced.matches && !paused && visible && !document.hidden) frame = window.requestAnimationFrame(tick);
      else paint();
    };

    if (toggle) {
      toggle.addEventListener("click", () => {
        paused = !paused;
        const text = paused ? "Play animation" : "Pause animation";
        toggle.setAttribute("aria-pressed", String(paused));
        toggle.setAttribute("aria-label", text);
        toggle.title = text;
        sync();
      });
    }
    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);
    else window.addEventListener("resize", resize);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => {
        visible = entries[entries.length - 1].isIntersecting;
        sync();
      }).observe(figure);
    }
    figure.classList.add("is-live");
    resize();
    sync();
    running.push({ sync, paint: () => (frame === null ? paint() : null) });
  };

  /* Posts: reading progress as denoising. Text already read is clean; the rest of the
   * line is still noisy, more so the further ahead it lies. */
  const progress = document.querySelector("[data-denoise-progress]");
  const mountProgress = () => {
    const canvas = progress.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const random = seeded(5);
    const offsets = [];
    for (let i = 0; i < 640; i += 1) offsets.push(clamp(gauss(random) * 0.6, -1, 1));
    let width = 0;
    let height = 0;
    let pending = false;
    const draw = () => {
      pending = false;
      const box = canvas.getBoundingClientRect();
      if (!box.width) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      if (box.width !== width || box.height !== height) {
        width = box.width;
        height = box.height;
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const read = scrollable > 0 ? clamp(window.scrollY / scrollable, 0, 1) : 0;
      const front = read * width;
      const step = 6;
      const middle = height / 2;
      ctx.fillStyle = rgba(palette.accent);
      ctx.beginPath();
      for (let i = 0, x = 3; x < front && i < offsets.length; i += 1, x += step) {
        ctx.moveTo(x + 1.3, middle);
        ctx.arc(x, middle, 1.3, 0, TAU);
      }
      ctx.fill();
      ctx.fillStyle = rgba(palette.ink, 0.45);
      ctx.beginPath();
      for (let i = 0, x = 3; x < width && i < offsets.length; i += 1, x += step) {
        if (x < front) continue;
        const sigma = smooth((x - front) / Math.max(80, width * 0.22));
        const y = middle + sigma * offsets[i] * (height / 2 - 1.5);
        ctx.moveTo(x + 1.1, y);
        ctx.arc(x, y, 1.1, 0, TAU);
      }
      ctx.fill();
    };
    const request = () => {
      if (!pending) {
        pending = true;
        window.requestAnimationFrame(draw);
      }
    };
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    window.addEventListener("load", request);
    running.push({ sync: request, paint: request });
    request();
  };

  readPalette();
  // Shared with assets/js/home.js, which loads after this file.
  window.ResearchMotifs = { palette, rgba, seeded, gauss, normal, clamp, lerp, smooth, ease, PLAN, planBatch };
  new MutationObserver(() => {
    readPalette();
    running.forEach((item) => item.paint());
    document.dispatchEvent(new CustomEvent("motifs:palette"));
  }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

  document.querySelectorAll("[data-motif]").forEach(mount);
  if (progress) mountProgress();
  if (!running.length) return;

  const syncAll = () => running.forEach((item) => item.sync());
  document.addEventListener("visibilitychange", syncAll);
  if (reduced.addEventListener) reduced.addEventListener("change", syncAll);
  else if (reduced.addListener) reduced.addListener(syncAll);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => running.forEach((item) => item.paint()));
})();
