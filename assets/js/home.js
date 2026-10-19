/* Home page: a 3D showcase of the research problems behind the page, and a portrait that is
 * sampled from noise when the page opens. Helpers come from motifs.js (window.ResearchMotifs).
 * Without JavaScript the stage stays empty; with reduced motion it shows still frames. */
(() => {
  "use strict";

  const lib = window.ResearchMotifs;
  if (!lib) return;
  const { palette, rgba, seeded, gauss, normal, clamp, lerp, smooth, ease, PLAN, planBatch } = lib;
  const TAU = Math.PI * 2;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- Portrait: a diffusion sampler run in reverse on the real photo ----------
   * x_t = alpha_t * x0_hat + sigma_t * noise, with a cosine schedule. The estimate x0_hat is the
   * photo seen at a resolution that grows as t falls, so structure appears coarse to fine. */
  const photo = document.querySelector("[data-denoise-photo]");
  const samplePhoto = () => {
    const img = photo.querySelector("img");
    const finish = () => photo.classList.remove("is-sampling");
    if (!img || reduced.matches) return finish();

    const ready = img.complete && img.naturalWidth ? Promise.resolve() : new Promise((resolve) => {
      img.addEventListener("load", resolve, { once: true });
      img.addEventListener("error", resolve, { once: true });
    });
    ready.then(() => {
      if (!img.naturalWidth) return finish();
      const box = img.getBoundingClientRect();
      const host = photo.getBoundingClientRect();
      const width = Math.max(1, Math.round(box.width));
      const height = Math.max(1, Math.round(box.height));
      const canvas = document.createElement("canvas");
      canvas.className = "photo-sampler";
      canvas.width = width;
      canvas.height = height;
      canvas.setAttribute("aria-hidden", "true");
      Object.assign(canvas.style, {
        left: `${box.left - host.left}px`,
        top: `${box.top - host.top}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
      });
      const chip = document.createElement("span");
      chip.className = "photo-step";
      chip.setAttribute("aria-hidden", "true");
      photo.appendChild(canvas);
      photo.appendChild(chip);

      // Crop like object-fit: cover, centered.
      const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
      const sw = width / scale;
      const sh = height / scale;
      const sx = (img.naturalWidth - sw) / 2;
      const sy = (img.naturalHeight - sh) / 2;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const small = document.createElement("canvas").getContext("2d");
      const pixels = width * height;
      const random = seeded(2024);
      const bank = new Float32Array(pixels * 3 + 4096);
      for (let i = 0; i < bank.length; i += 1) bank[i] = gauss(random);

      const STEPS = 28;
      const STEP_MS = 62;
      const estimate = (resolution) => {
        // Photo at reduced resolution, smoothly upscaled: the sampler's blurry guess of x0.
        const w = Math.max(2, Math.round(width * resolution));
        const h = Math.max(2, Math.round(height * resolution));
        small.canvas.width = w;
        small.canvas.height = h;
        small.imageSmoothingQuality = "high";
        small.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(small.canvas, 0, 0, w, h, 0, 0, width, height);
        return ctx.getImageData(0, 0, width, height);
      };
      const render = (step) => {
        const t = 1 - step / STEPS;
        const abar = Math.pow(Math.cos(((t + 0.008) / 1.008) * Math.PI / 2), 2);
        const alpha = Math.sqrt(abar);
        const sigma = Math.sqrt(1 - abar);
        const frame = estimate(0.035 + 0.965 * Math.pow(1 - t, 1.6));
        const data = frame.data;
        const offset = Math.floor(random() * 4096);
        for (let i = 0, n = offset; i < data.length; i += 4, n += 3) {
          data[i] = 127.5 * (1 + alpha * (data[i] / 127.5 - 1) + sigma * bank[n]);
          data[i + 1] = 127.5 * (1 + alpha * (data[i + 1] / 127.5 - 1) + sigma * bank[n + 1]);
          data[i + 2] = 127.5 * (1 + alpha * (data[i + 2] / 127.5 - 1) + sigma * bank[n + 2]);
        }
        ctx.putImageData(frame, 0, 0);
        chip.textContent = `t = ${t.toFixed(2)}`;
      };

      let start = null;
      let shown = -1;
      const tick = (now) => {
        if (start === null) start = now;
        const step = Math.min(STEPS, Math.floor((now - start) / STEP_MS));
        if (step !== shown) {
          render(step);
          shown = step;
        }
        if (step < STEPS) {
          window.requestAnimationFrame(tick);
          return;
        }
        // Hand over to the full-resolution photo, then remove the sampler.
        finish();
        canvas.classList.add("is-done");
        chip.classList.add("is-done");
        window.setTimeout(() => {
          canvas.remove();
          chip.remove();
        }, 700);
      };
      render(0);
      window.requestAnimationFrame(tick);
    });
  };
  if (photo) samplePhoto();

  /* ---------- Showcase: the research problems, one after another, behind the page ----------
   * Four scenes share one 3D floor: MixFlow (generative flows), uncertainty over possible futures,
   * world models that plan by denoising trajectories, and representation learning (encode to a latent
   * code, noise it to a Gaussian, denoise it back). The camera orbits slowly on its own clock. Scenes
   * change by dissolving into noise while the next one is denoised out of it. */
  const space = document.querySelector("[data-showcase-space]");
  let ctx = null;
  let cam = null;
  // Screen-space jitter for the noise transitions, stable for a given world point.
  const hash = (a, b, c) => {
    const v = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
    return v - Math.floor(v) - 0.5;
  };
  // World: x runs left to right (flow or time), z runs into the screen, y is height.
  const project = (x, y, z) => {
    const x1 = x * cam.cyaw + z * cam.syaw;
    const z1 = -x * cam.syaw + z * cam.cyaw;
    const yc = y * cam.cpitch + z1 * cam.spitch;
    const zc = -y * cam.spitch + z1 * cam.cpitch + cam.dist;
    const k = cam.f / zc;
    if (!cam.noise) return [cam.cx + x1 * k, cam.cy - yc * k, zc, k];
    return [cam.cx + x1 * k + cam.noise * hash(x, y, z), cam.cy - yc * k + cam.noise * hash(z, x, y), zc, k];
  };
  const fog = (depth) => clamp(1.35 - (depth - cam.dist + 1.4) / 3.2, 0.12, 1);
  const stroke = (points, rgb, alpha, width) => {
    if (points.length < 2 || alpha <= 0.003) return;
    ctx.strokeStyle = rgba(rgb, alpha);
    ctx.lineWidth = width || 1;
    ctx.beginPath();
    points.forEach((p, i) => {
      const q = project(p[0], p[1], p[2]);
      if (i === 0) ctx.moveTo(q[0], q[1]);
      else ctx.lineTo(q[0], q[1]);
    });
    ctx.stroke();
  };
  const dot = (x, y, z, radius, rgb, alpha) => {
    const q = project(x, y, z);
    ctx.fillStyle = rgba(rgb, alpha * fog(q[2]));
    ctx.beginPath();
    ctx.arc(q[0], q[1], Math.max(0.6, (radius * q[3]) / 160), 0, TAU);
    ctx.fill();
  };

  const grid = (strength, xMin, xMax, zMax) => {
    const depth = zMax || 1.2;
    ctx.lineWidth = 1;
    const line = (a, b) => {
      for (let i = 0; i < 10; i += 1) {
        const x0 = lerp(a[0], b[0], i / 10);
        const x1 = lerp(a[0], b[0], (i + 1) / 10);
        const p = project(x0, 0, lerp(a[2], b[2], i / 10));
        const q = project(x1, 0, lerp(a[2], b[2], (i + 1) / 10));
        const edge = smooth(((x0 + x1) / 2 - xMin) / 1.6);
        ctx.strokeStyle = rgba(palette.rule, strength * edge * fog((p[2] + q[2]) / 2));
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        ctx.lineTo(q[0], q[1]);
        ctx.stroke();
      }
    };
    const first = Math.ceil(xMin / 0.4) * 0.4;
    for (let x = first; x <= xMax + 0.001; x += 0.4) line([x, 0, -depth], [x, 0, depth]);
    for (let z = -depth; z <= depth + 0.001; z += depth / 4) line([xMin, 0, z], [xMax, 0, z]);
  };

  // MixFlow in 3D: densities stand on the floor as ridges; particles flow between them.
  const flow = (() => {
    const MODES = [-0.62, 0.08, 0.66];
    const SPREAD = [0.07, 0.06, 0.08];
    const MEAN = (MODES[0] + MODES[1] + MODES[2]) / 3;
    const XS = -1.35;
    const XD = 1.35;
    const LIFE = 6;
    const CYCLE = 18;
    const random = seeded(42);
    const particles = [];
    for (let i = 0; i < 64; i += 1) particles.push({ k: i % 3, z: gauss(random), z1: gauss(random), offset: (i / 64) * LIFE + random() * 0.5 });
    const weight = (t) => 0.5 - 0.5 * Math.cos((TAU * t) / CYCLE);
    const mean = (k, w) => w * 0.92 * MODES[k];
    const sd = (w) => (1 - w) * 0.36 + w * 0.11;
    const path = (z0, z1, w, s) => {
      const control = lerp((z0 + z1) / 2, MEAN, 0.9 * (1 - w));
      return (1 - s) * (1 - s) * z0 + 2 * (1 - s) * s * control + s * s * z1;
    };
    const ridge = (x, pdf, strength) => {
      let peak = 0;
      const values = [];
      for (let z = -1.05; z <= 1.0501; z += 0.03) {
        const p = pdf(z);
        values.push([z, p]);
        peak = Math.max(peak, p);
      }
      const points = values.map(([z, p]) => [x, (p / peak) * 0.5, z]);
      ctx.beginPath();
      const first = project(x, 0, values[0][0]);
      ctx.moveTo(first[0], first[1]);
      points.forEach((p) => {
        const q = project(p[0], p[1], p[2]);
        ctx.lineTo(q[0], q[1]);
      });
      const last = project(x, 0, values[values.length - 1][0]);
      ctx.lineTo(last[0], last[1]);
      ctx.closePath();
      ctx.fillStyle = rgba(palette.accent, 0.08 * strength);
      ctx.fill();
      stroke(points, palette.accent, 0.65 * strength, 1.1);
    };
    return (t, strength) => {
      const w = weight(t);
      for (let k = 0; k < 3; k += 1) {
        [-1, 0, 1].forEach((z) => {
          const z0 = mean(k, w) + sd(w) * z;
          const z1 = MODES[k] + SPREAD[k] * z;
          const points = [];
          for (let i = 0; i <= 24; i += 1) points.push([lerp(XS, XD, i / 24), 0.05 * Math.sin((Math.PI * i) / 24), path(z0, z1, w, i / 24)]);
          stroke(points, palette.rule, 0.95 * strength);
        });
      }
      ridge(XS, (z) => (normal(z, mean(0, w), sd(w)) + normal(z, mean(1, w), sd(w)) + normal(z, mean(2, w), sd(w))) / 3, strength);
      ridge(XD, (z) => (normal(z, MODES[0], SPREAD[0]) + normal(z, MODES[1], SPREAD[1]) + normal(z, MODES[2], SPREAD[2])) / 3, strength);
      particles.forEach((p) => {
        const age = (((t + p.offset) % LIFE) + LIFE) % LIFE;
        const s = age / LIFE;
        const born = weight(t - age);
        const z0 = mean(p.k, born) + sd(born) * p.z;
        const z1 = MODES[p.k] + SPREAD[p.k] * p.z1;
        const fade = smooth(s / 0.06) * (1 - smooth((s - 0.94) / 0.06));
        const trail = [];
        for (let i = 0; i <= 6; i += 1) {
          const q = Math.max(0, s - 0.14 + (0.14 * i) / 6);
          trail.push([lerp(XS, XD, q), 0.05 * Math.sin(Math.PI * q), path(z0, z1, born, q)]);
        }
        stroke(trail, palette.accent, 0.4 * fade * strength);
        dot(lerp(XS, XD, s), 0.05 * Math.sin(Math.PI * s), path(z0, z1, born, s), 2.4, palette.accent, fade * strength);
      });
    };
  })();

  // A world model's forecast in 3D: a trajectory with its floor shadow, then a cone of futures.
  const forecast = (() => {
    const NOW = 0.2;
    const random = seeded(11);
    const samples = [];
    for (let j = 0; j < 12; j += 1) {
      samples.push({
        ay: (0.5 + random()) * 0.5, fy: 0.8 + 0.8 * random(), py: random() * TAU,
        az: (0.5 + random()) * 0.6, fz: 0.6 + 0.7 * random(), pz: random() * TAU,
        drift: 0.15 + 0.25 * random(),
      });
    }
    const height = (s) => 0.3 + 0.13 * (0.55 * Math.sin(0.9 * s) + 0.28 * Math.sin(2.1 * s + 1) + 0.14 * Math.sin(3.7 * s + 2.2));
    const depth = (s) => 0.45 * (0.6 * Math.sin(0.6 * s + 1) + 0.35 * Math.sin(1.5 * s + 0.4));
    return (t, strength) => {
      const present = t * 0.32;
      const sAt = (x) => present + (x - NOW) * 1.6;
      const past = [];
      const shadow = [];
      for (let x = -1.55; x <= NOW + 0.001; x += 0.03) {
        past.push([x, height(sAt(x)), depth(sAt(x))]);
        shadow.push([x, 0, depth(sAt(x))]);
      }
      stroke(shadow, palette.rule, 0.9 * strength);
      for (let s = Math.ceil(sAt(-1.55) / 0.5) * 0.5; s <= present; s += 0.5) {
        const x = NOW + (s - present) / 1.6;
        stroke([[x, 0, depth(s)], [x, height(s), depth(s)]], palette.rule, 0.8 * strength);
        dot(x, height(s), depth(s), 2.4, palette.ink, 0.8 * strength);
      }
      stroke(past, palette.ink, 0.75 * strength, 1.4);

      const plane = [[NOW, 0, -0.95], [NOW, 0.6, -0.95], [NOW, 0.6, 0.95], [NOW, 0, 0.95]];
      ctx.beginPath();
      plane.forEach((p, i) => {
        const q = project(p[0], p[1], p[2]);
        if (i === 0) ctx.moveTo(q[0], q[1]);
        else ctx.lineTo(q[0], q[1]);
      });
      ctx.closePath();
      ctx.fillStyle = rgba(palette.accent, 0.04 * strength);
      ctx.fill();
      ctx.strokeStyle = rgba(palette.accent, 0.4 * strength);
      ctx.lineWidth = 1;
      ctx.stroke();

      const horizon = 1.55 - NOW;
      samples.forEach((p, j) => {
        const line = [];
        const floor = [];
        for (let h = 0; h <= horizon + 0.001; h += 0.04) {
          const spread = Math.pow(h / horizon, 0.9);
          const s = present + h * 1.6;
          const y = Math.max(0.02, height(s) + spread * 0.14 * p.ay * Math.sin(p.fy * h * 3 + p.py + p.drift * t + j));
          const z = depth(s) + spread * 0.55 * p.az * Math.sin(p.fz * h * 3 + p.pz + p.drift * t);
          line.push([NOW + h, y, z]);
          floor.push([NOW + h, 0, z]);
        }
        stroke(floor, palette.rule, 0.45 * strength);
        stroke(line, palette.accent, 0.42 * strength);
      });
    };
  })();

  // Planning by diffusion in 3D: obstacles are pillars, plans are denoised on the floor.
  const plan = (() => {
    const { BOX, START, GOAL, OBSTACLES } = PLAN;
    const CYCLE = 8;
    const U = 1.556;
    const X = (u) => (u - BOX / 2) * U;
    const Z = (v) => (0.5 - v) * U;
    const pin = (u, v, rgb, alpha) => {
      stroke([[X(u), 0, Z(v)], [X(u), 0.2, Z(v)]], rgb, alpha, 1.2);
      dot(X(u), 0.2, Z(v), 3.2, rgb, alpha);
    };
    return (t, strength) => {
      const c = Math.floor(t / CYCLE);
      const phase = t / CYCLE - c;
      const sigma = phase < 0.5 ? Math.pow(1 - phase / 0.5, 2) : 0;
      const select = smooth((phase - 0.5) / 0.08);
      const travel = ease((phase - 0.58) / 0.3);
      const alpha = smooth(phase / 0.05) * (1 - smooth((phase - 0.93) / 0.07)) * strength;
      const { plans, best } = planBatch(c);

      OBSTACLES.forEach((o) => {
        const ring = (y) => {
          const points = [];
          for (let i = 0; i <= 28; i += 1) points.push([X(o[0]) + Math.cos((TAU * i) / 28) * o[2] * U, y, Z(o[1]) + Math.sin((TAU * i) / 28) * o[2] * U]);
          return points;
        };
        const top = ring(0.3);
        ctx.beginPath();
        top.forEach((p, i) => {
          const q = project(p[0], p[1], p[2]);
          if (i === 0) ctx.moveTo(q[0], q[1]);
          else ctx.lineTo(q[0], q[1]);
        });
        ctx.fillStyle = rgba(palette.soft, 0.7 * strength);
        ctx.fill();
        stroke(ring(0), palette.rule, strength);
        stroke(top, palette.rule, strength);
        // Silhouette edges: the leftmost and rightmost points of the base on screen.
        const base = ring(0).map((p) => [p, project(p[0], p[1], p[2])[0]]);
        const left = base.reduce((a, b) => (b[1] < a[1] ? b : a));
        const right = base.reduce((a, b) => (b[1] > a[1] ? b : a));
        [left, right].forEach(([p]) => stroke([p, [p[0], 0.3, p[2]]], palette.rule, strength));
      });

      plans.forEach((item, j) => {
        const chosen = j === best;
        const points = item.points.map((p, i) => [
          X(clamp(p[0] + sigma * item.noise[i][0], 0, BOX)),
          0.004,
          Z(clamp(p[1] + sigma * item.noise[i][1], 0, 1)),
        ]);
        stroke(points, palette.accent, alpha * lerp(0.5, chosen ? 1 : 0.14, select), chosen ? lerp(1, 1.8, select) : 1);
      });

      if (travel > 0) {
        const route = plans[best].points;
        const lengths = [0];
        for (let i = 1; i < route.length; i += 1) lengths.push(lengths[i - 1] + Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]));
        const target = travel * lengths[lengths.length - 1];
        let i = 1;
        while (i < route.length - 1 && lengths[i] < target) i += 1;
        const f = (target - lengths[i - 1]) / Math.max(1e-6, lengths[i] - lengths[i - 1]);
        const u = lerp(route[i - 1][0], route[i][0], f);
        const v = lerp(route[i - 1][1], route[i][1], f);
        stroke([[X(u), 0, Z(v)], [X(u), 0.1, Z(v)]], palette.accent, alpha);
        dot(X(u), 0.1, Z(v), 4.2, palette.accent, alpha);
      }
      pin(START[0], START[1], palette.ink, 0.8 * strength);
      pin(GOAL[0], GOAL[1], palette.accent, strength);
    };
  })();

  // Representation: an image (the portrait from the header) is encoded into a latent made of stacked
  // slabs (a C x H x W tensor).
  // Noising breaks the slabs into dots that spread into a dense Gaussian cloud; then the diffusion
  // model appears as a vector field and drags every dot back until the slabs re-form.
  const latent = (() => {
    const CYCLE = 14;
    // The data sample: the header portrait, cropped to head and shoulders (fractions of the photo).
    const photo = document.querySelector("[data-denoise-photo] img");
    const CROP = [0.234, 0.1875, 0.5, 0.5];
    const IMG = { x0: -1.66, x1: -1.1, y0: 0.06, y1: 0.62, z: 0 };
    const ENC = { x0: -1.0, x1: -0.52, wide: [0.06, 0.62], thin: [0.25, 0.43], wideZ: 0.16, thinZ: 0.07 };
    const SLABS = 4;
    // Four layers stacked upward into a cube: x0..x1 by z0..z1, each LAT.thick tall.
    const LAT = { x0: -0.4, x1: 0.02, z0: -0.21, z1: 0.21, base: 0.06, thick: 0.085, gap: 0.035 };
    const slabY = (k) => LAT.base + k * (LAT.thick + LAT.gap);
    const TOP = slabY(SLABS - 1) + LAT.thick;
    const CLOUD = [0.95, 0.36, 0.02];
    const SPREAD = [0.3, 0.16, 0.26];
    const CELLS = 9;
    const random = seeded(77);
    const dots = [];
    for (let k = 0; k < SLABS; k += 1) {
      for (let r = 0; r < CELLS; r += 1) {
        for (let c = 0; c < CELLS; c += 1) {
          dots.push({
            home: [lerp(LAT.x0, LAT.x1, (c + 0.5) / CELLS), slabY(k) + LAT.thick / 2, lerp(LAT.z0, LAT.z1, (r + 0.5) / CELLS)],
            noise: [CLOUD[0] + SPREAD[0] * gauss(random), clamp(CLOUD[1] + SPREAD[1] * gauss(random), 0.02, 0.78), CLOUD[2] + SPREAD[2] * gauss(random)],
            delay: random(),
            wobble: random() * TAU,
          });
        }
      }
    }
    // The diffusion model's field: at each lattice point, the direction back to the latent.
    const arrows = [];
    for (let x = -0.02; x <= 1.36; x += 0.17) {
      [0.14, 0.34, 0.56].forEach((y) => {
        [-0.26, 0.02, 0.3].forEach((z) => {
          const target = [clamp(x, LAT.x0, LAT.x1), clamp(y, LAT.base, TOP), clamp(z, LAT.z0, LAT.z1)];
          const d = [target[0] - x, target[1] - y, target[2] - z];
          const n = Math.hypot(d[0], d[1], d[2]) || 1;
          arrows.push({ from: [x, y, z], dir: [d[0] / n, d[1] / n, d[2] / n] });
        });
      });
    }
    const streams = [];
    for (let j = 0; j < 30; j += 1) {
      streams.push({
        start: [lerp(IMG.x0, IMG.x1, 0.1 + 0.8 * random()), lerp(IMG.y0, IMG.y1, 0.1 + 0.8 * random()), IMG.z],
        v: random() * 2 - 1,
        end: dots[Math.floor(random() * dots.length)].home,
        offset: j / 30,
      });
    }
    const face = (points, rgb, alpha) => {
      if (alpha <= 0.003) return;
      ctx.beginPath();
      points.forEach((p, i) => {
        const q = project(p[0], p[1], p[2]);
        if (i === 0) ctx.moveTo(q[0], q[1]);
        else ctx.lineTo(q[0], q[1]);
      });
      ctx.closePath();
      ctx.fillStyle = rgba(rgb, alpha);
      ctx.fill();
    };
    // One layer of the latent: front, right and top faces filled, edges outlined.
    const slab = (k, alpha) => {
      const y0 = slabY(k);
      const y1 = y0 + LAT.thick;
      const { x0, x1, z0, z1 } = LAT;
      const shade = 0.14 + 0.08 * k;
      face([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], palette.accent, (shade + 0.1) * alpha);
      face([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], palette.accent, (shade + 0.05) * alpha);
      face([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], palette.accent, shade * alpha);
      const edges = [
        [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z0]],
        [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]],
        [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1]],
      ];
      edges.forEach((edge) => stroke(edge, palette.accent, 0.85 * alpha));
    };
    const along = (points, s) => {
      const span = s * (points.length - 1);
      const i = Math.min(points.length - 2, Math.floor(span));
      const f = span - i;
      return [lerp(points[i][0], points[i + 1][0], f), lerp(points[i][1], points[i + 1][1], f), lerp(points[i][2], points[i + 1][2], f)];
    };

    return (t, strength) => {
      const phase = (((t % CYCLE) + CYCLE) % CYCLE) / CYCLE;
      const alpha = smooth(phase / 0.04) * (1 - smooth((phase - 0.96) / 0.04)) * strength;
      if (alpha <= 0.003) return;
      const encode = clamp((phase - 0.04) / 0.16, 0, 1);
      const decompose = smooth((phase - 0.27) / 0.06);
      const field = smooth((phase - 0.52) / 0.06) * (1 - smooth((phase - 0.86) / 0.05));
      const reform = smooth((phase - 0.84) / 0.06);

      // The image, facing the camera. Its plane is small, so an affine map from three projected
      // corners is a close match to the true perspective.
      if (photo && photo.complete && photo.naturalWidth) {
        const origin = project(IMG.x0, IMG.y1, IMG.z);
        const right = project(IMG.x1, IMG.y1, IMG.z);
        const down = project(IMG.x0, IMG.y0, IMG.z);
        const w = photo.naturalWidth;
        const h = photo.naturalHeight;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.transform(right[0] - origin[0], right[1] - origin[1], down[0] - origin[0], down[1] - origin[1], origin[0], origin[1]);
        ctx.drawImage(photo, CROP[0] * w, CROP[1] * h, CROP[2] * w, CROP[3] * h, 0, 0, 1, 1);
        ctx.restore();
      }
      stroke([[IMG.x0, IMG.y0, IMG.z], [IMG.x1, IMG.y0, IMG.z], [IMG.x1, IMG.y1, IMG.z], [IMG.x0, IMG.y1, IMG.z], [IMG.x0, IMG.y0, IMG.z]], palette.ink, 0.6 * alpha);

      // The encoder: a wedge narrowing from the image to the latent.
      const W = [[ENC.x0, ENC.wide[0], -ENC.wideZ], [ENC.x0, ENC.wide[1], -ENC.wideZ], [ENC.x0, ENC.wide[1], ENC.wideZ], [ENC.x0, ENC.wide[0], ENC.wideZ]];
      const N = [[ENC.x1, ENC.thin[0], -ENC.thinZ], [ENC.x1, ENC.thin[1], -ENC.thinZ], [ENC.x1, ENC.thin[1], ENC.thinZ], [ENC.x1, ENC.thin[0], ENC.thinZ]];
      face([W[1], N[1], N[2], W[2]], palette.accent, 0.1 * alpha);
      face([W[0], N[0], N[1], W[1]], palette.accent, 0.2 * alpha);
      stroke(W.concat([W[0]]), palette.accent, 0.7 * alpha);
      stroke(N.concat([N[0]]), palette.accent, 0.7 * alpha);
      for (let i = 0; i < 4; i += 1) stroke([W[i], N[i]], palette.accent, 0.7 * alpha);

      // Encoding: points leave the image, pass through the encoder, and land in the latent.
      if (encode > 0 && encode < 1) {
        streams.forEach((p) => {
          const s = clamp(encode * 1.6 - p.offset * 0.6, 0, 1);
          if (s <= 0 || s >= 1) return;
          const route = [p.start, [ENC.x0, lerp(ENC.wide[0], ENC.wide[1], 0.5 + p.v * 0.4), 0], [ENC.x1, lerp(ENC.thin[0], ENC.thin[1], 0.5 + p.v * 0.4), 0], p.end];
          const head = along(route, s);
          const tail = along(route, Math.max(0, s - 0.07));
          stroke([tail, head], palette.accent, 0.5 * alpha);
          dot(head[0], head[1], head[2], 2.2, palette.accent, alpha);
        });
      }

      // The latent tensor: slabs appear as they are encoded, then break into dots.
      const solid = Math.max(0, Math.min(1 - decompose, 1) + reform);
      for (let k = 0; k < SLABS; k += 1) {
        const built = smooth((encode - 0.35 - k * 0.12) / 0.2);
        slab(k, Math.min(1, built * solid) * alpha);
      }

      // Noising and denoising, dot by dot (staggered slightly).
      if (decompose > 0) {
        dots.forEach((d) => {
          const forward = ease(clamp((phase - 0.33 - d.delay * 0.05) / 0.15, 0, 1));
          const back = ease(clamp((phase - 0.58 - d.delay * 0.05) / 0.25, 0, 1));
          const sigma = forward * (1 - back);
          const hover = 0.012 * sigma * Math.sin(t * 2 + d.wobble);
          const at = (q) => [lerp(d.home[0], d.noise[0], q), lerp(d.home[1], d.noise[1], q) + hover, lerp(d.home[2], d.noise[2], q)];
          const p = at(sigma);
          const visible = decompose * (1 - reform) * alpha;
          if (back > 0 && back < 1) {
            const before = ease(clamp((phase - 0.008 - 0.58 - d.delay * 0.05) / 0.25, 0, 1));
            stroke([at(forward * (1 - before)), p], palette.accent, 0.35 * visible);
          }
          dot(p[0], p[1], p[2], 1.7, palette.accent, visible);
        });
      }

      // The diffusion model as a vector field pointing back to the latent.
      if (field > 0.01) {
        ctx.lineWidth = 1;
        arrows.forEach((a) => {
          const tip = [a.from[0] + a.dir[0] * 0.1, a.from[1] + a.dir[1] * 0.1, a.from[2] + a.dir[2] * 0.1];
          const p = project(a.from[0], a.from[1], a.from[2]);
          const q = project(tip[0], tip[1], tip[2]);
          const angle = Math.atan2(q[1] - p[1], q[0] - p[0]);
          const head = Math.min(5, Math.hypot(q[0] - p[0], q[1] - p[1]) * 0.45);
          ctx.strokeStyle = rgba(palette.ink, 0.8 * field * alpha * fog(p[2]));
          ctx.beginPath();
          ctx.moveTo(p[0], p[1]);
          ctx.lineTo(q[0], q[1]);
          ctx.moveTo(q[0] - head * Math.cos(angle - 0.5), q[1] - head * Math.sin(angle - 0.5));
          ctx.lineTo(q[0], q[1]);
          ctx.lineTo(q[0] - head * Math.cos(angle + 0.5), q[1] - head * Math.sin(angle + 0.5));
          ctx.stroke();
        });
      }
    };
  })();

  const SCENES = { flow, forecast, plan, latent };

  const ORDER = ["flow", "forecast", "plan", "latent"];
  // One line each, short enough for a phone.
  const CAPTIONS = {
    flow: "Mixing the source straightens paths to the data",
    forecast: "Possible futures spread out with the horizon",
    plan: "Planning by denoising candidate trajectories",
    latent: "Encode, noise to a Gaussian, denoise back",
  };
  // How long each scene stays, and the moment shown as a still frame with reduced motion.
  const HOLDS = { flow: 13, forecast: 13, plan: 16, latent: 14 };
  const STILLS = { flow: 6, forecast: 3, plan: 5.4, latent: 9.6 };
  const BLEND = 1.8;
  const NOISE = 46;

  const panel = document.querySelector("[data-showcase-control]");
  if (!space || !panel) return;
  const canvas = space.querySelector("canvas");
  if (!canvas) return;
  const own = canvas.getContext("2d");
  const toggle = panel.querySelector("[data-showcase-toggle]");
  const topics = Array.from(panel.querySelectorAll("[data-showcase-topic]"));
  const caption = panel.querySelector("[data-showcase-caption]");
  const view = { yaw: -0.32, pitch: 0.3, dist: 4.4, f: 500, cx: 0, cy: 0, cyaw: 1, syaw: 0, cpitch: 1, spitch: 0, noise: 0 };
  const starts = { flow: 0, forecast: 0, plan: 0, latent: 0 };
  let width = 0;
  let height = 0;
  let current = 0;
  let next = 0;
  let sceneClock = 0;
  let blend = 1;
  let orbit = 0;
  let time = 0;
  let last = null;
  let frame = null;
  let paused = false;
  let visible = true;

  // Each scene runs on its own clock from when it came on, so every story starts at its beginning.
  const local = (name) => (reduced.matches ? STILLS[name] : time - starts[name]);

  const layout = () => {
    const box = space.getBoundingClientRect();
    if (!box.width || !box.height) return false;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = box.width;
    height = box.height;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    own.setTransform(ratio, 0, 0, ratio, 0, 0);
    // A wide, short band: fit the height first, then the width.
    view.f = Math.min((height * view.dist) / 1.3, (width * view.dist) / 4.2);
    view.cx = width / 2;
    view.cy = height * 0.68;
    return true;
  };

  const announce = (index) => {
    const name = ORDER[index];
    topics.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.showcaseTopic === name)));
    if (caption) caption.textContent = CAPTIONS[name];
  };
  const go = (index) => {
    if (index === current && blend >= 1) return;
    next = index;
    blend = 0;
    starts[ORDER[index]] = time;
    announce(index);
  };

  const paint = () => {
    if (!width) return;
    view.yaw = -0.32 + 0.22 * Math.sin((TAU * orbit) / 52);
    view.pitch = 0.3 + 0.04 * Math.sin((TAU * orbit) / 37);
    view.cyaw = Math.cos(view.yaw);
    view.syaw = Math.sin(view.yaw);
    view.cpitch = Math.cos(view.pitch);
    view.spitch = Math.sin(view.pitch);
    ctx = own;
    cam = view;
    ctx.clearRect(0, 0, width, height);
    view.noise = 0;
    grid(0.6, -1.8, 1.8, 0.95);
    if (blend < 1) {
      const p = smooth(blend);
      view.noise = NOISE * p;
      SCENES[ORDER[current]](local(ORDER[current]), 1 - p);
      view.noise = NOISE * (1 - p);
      SCENES[ORDER[next]](local(ORDER[next]), p);
      view.noise = 0;
    } else {
      SCENES[ORDER[current]](local(ORDER[current]), 1);
    }
  };

  const advance = (dt) => {
    time += dt;
    orbit += dt;
    if (blend < 1) {
      blend = Math.min(1, blend + dt / BLEND);
      if (blend >= 1) {
        current = next;
        sceneClock = 0;
      }
    } else {
      sceneClock += dt;
      if (sceneClock >= HOLDS[ORDER[current]]) go((current + 1) % ORDER.length);
    }
  };

  const tick = (now) => {
    const dt = last === null ? 0 : (now - last) / 1000;
    if (last === null || dt >= 1 / 40) {
      last = now;
      advance(Math.min(dt, 0.1));
      paint();
    }
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
  topics.forEach((button) => {
    button.addEventListener("click", () => {
      const index = ORDER.indexOf(button.dataset.showcaseTopic);
      if (index < 0) return;
      if (frame === null) {
        // Paused or reduced motion: switch at once, from the start of that scene.
        current = index;
        next = index;
        blend = 1;
        sceneClock = 0;
        starts[ORDER[index]] = time - (reduced.matches ? 0 : STILLS[ORDER[index]]);
        announce(index);
        paint();
      } else {
        go(index);
      }
    });
  });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      sync();
    }).observe(space);
  }
  if ("ResizeObserver" in window) {
    new ResizeObserver(() => {
      if (layout()) paint();
    }).observe(space);
  } else {
    window.addEventListener("resize", () => {
      if (layout()) paint();
    });
  }
  document.addEventListener("visibilitychange", sync);
  document.addEventListener("motifs:palette", () => {
    if (frame === null) paint();
  });
  if (reduced.addEventListener) reduced.addEventListener("change", sync);
  else if (reduced.addListener) reduced.addListener(sync);

  // Show the panel before measuring the band.
  panel.hidden = false;
  layout();
  announce(0);
  sync();
})();
