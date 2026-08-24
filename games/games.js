/* ---------- Games ----------
   Breakaway and Snake, drawn straight onto the page in the site palette.
   Each board runs only while it is open, on screen, and focused. */
(() => {
  const W = 480;
  const H = 320;
  const root = getComputedStyle(document.documentElement);
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function swatch(name, fallback) {
    const value = root.getPropertyValue(name).trim();
    return value.startsWith("#") ? value : fallback;
  }

  const theme = {
    accent: swatch("--accent", "#67e8f9"),
    gold: swatch("--gold", "#f5c451"),
    green: swatch("--green", "#7ee0a8"),
    text: swatch("--text", "#e8eef6"),
    border: swatch("--border", "#1c2740"),
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function channels(hex) {
    const n = parseInt(hex.slice(1), 16);
    return hex.length === 4
      ? [((n >> 8) & 15) * 17, ((n >> 4) & 15) * 17, (n & 15) * 17]
      : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function fade(hex, a) {
    const [r, g, b] = channels(hex);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  function blend(from, to, t) {
    const a = channels(from);
    const b = channels(to);
    const at = (i) => Math.round(a[i] + (b[i] - a[i]) * clamp(t, 0, 1));
    return `rgb(${at(0)}, ${at(1)}, ${at(2)})`;
  }

  function glow(ctx, color, blur) {
    ctx.fillStyle = color;
    ctx.shadowColor = calm ? "transparent" : color;
    ctx.shadowBlur = calm ? 0 : blur;
  }

  function block(ctx, x, y, w, h, r, color, blur = 0) {
    ctx.save();
    glow(ctx, color, blur);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.restore();
  }

  function dot(ctx, x, y, r, color, blur = 0) {
    ctx.save();
    glow(ctx, color, blur);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function grid(ctx, size) {
    ctx.save();
    ctx.strokeStyle = fade(theme.border, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = size; x < W; x += size) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, H);
    }
    for (let y = size; y < H; y += size) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(W, y + 0.5);
    }
    ctx.stroke();
    ctx.restore();
  }

  function touches(cx, cy, r, rx, ry, rw, rh) {
    const nx = clamp(cx, rx, rx + rw);
    const ny = clamp(cy, ry, ry + rh);
    return (cx - nx) ** 2 + (cy - ny) ** 2 <= r * r;
  }

  /* Tilt input. iOS hands orientation out only after a permission call made
     inside a tap, so every board carries its own opt-in button. */
  const TILT_SPAN = 10;                   /* degrees of tilt for full deflection */
  const TILT_DEAD = 2;                    /* degrees ignored around the neutral pose */

  function tiltAvailable() {
    if (typeof DeviceOrientationEvent === "undefined") return false;
    if (typeof DeviceOrientationEvent.requestPermission === "function") return true;
    return "ondeviceorientation" in window && matchMedia("(pointer: coarse)").matches;
  }

  function shape(deg) {
    const past = Math.abs(deg) - TILT_DEAD;
    if (past <= 0) return 0;
    return clamp((past / (TILT_SPAN - TILT_DEAD)) * Math.sign(deg), -1, 1);
  }

  const again = (score) =>
    `${score} ${score === 1 ? "point" : "points"} &middot; click or press <b>S</b> to play again`;

  /* ---------- Breakaway ---------- */
  function breakaway() {
    const paddleW = 74;
    const paddleH = 9;
    const paddleY = H - 24;
    const ballR = 5;
    const cols = 9;
    const rows = 5;
    const inset = 24;
    const gap = 5;
    const brickW = (W - inset * 2 - gap * (cols - 1)) / cols;
    const brickH = 15;
    const topRow = 46;

    let bricks = [];
    let paddleX = (W - paddleW) / 2;
    let ball = { x: 0, y: 0, vx: 0, vy: 0 };
    let trail = [];
    let left = false;
    let right = false;
    let speed = 215;
    let hold = 0;
    let lives = 3;
    let score = 0;

    function build() {
      bricks = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          bricks.push({
            x: inset + c * (brickW + gap),
            y: topRow + r * (brickH + gap),
            row: r,
            alive: true,
          });
        }
      }
    }

    function park() {
      hold = calm ? 0.35 : 0.7;
      ball = { x: paddleX + paddleW / 2, y: paddleY - ballR - 1, vx: 0, vy: 0 };
      trail = [];
    }

    function launch() {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
      ball.vx = Math.cos(angle) * speed;
      ball.vy = Math.sin(angle) * speed;
    }

    function smash() {
      for (const b of bricks) {
        if (!b.alive) continue;
        if (!touches(ball.x, ball.y, ballR, b.x, b.y, brickW, brickH)) continue;
        b.alive = false;
        score += rows - b.row;
        speed = Math.min(speed + 5, 400);
        const m = Math.hypot(ball.vx, ball.vy) || 1;
        ball.vx = (ball.vx / m) * speed;
        ball.vy = (ball.vy / m) * speed;
        return true;
      }
      return false;
    }

    return {
      title: "Breakaway",
      hint: "click or press <b>S</b> to start",
      get score() {
        return score;
      },
      stats: () => ({ score, lives }),

      reset() {
        score = 0;
        lives = 3;
        speed = 215;
        left = false;
        right = false;
        paddleX = (W - paddleW) / 2;
        build();
        park();
      },

      key(k, down) {
        if (k === "ArrowLeft") left = down;
        if (k === "ArrowRight") right = down;
      },

      point(x) {
        paddleX = clamp(x - paddleW / 2, 0, W - paddleW);
      },

      tilt(x) {
        const reach = W / 2 - paddleW / 2;
        paddleX = clamp(W / 2 + x * reach - paddleW / 2, 0, W - paddleW);
      },

      update(dt, api) {
        const nudge = 400 * dt;
        if (left) paddleX = clamp(paddleX - nudge, 0, W - paddleW);
        if (right) paddleX = clamp(paddleX + nudge, 0, W - paddleW);

        if (hold > 0) {
          hold -= dt;
          ball.x = paddleX + paddleW / 2;
          ball.y = paddleY - ballR - 1;
          if (hold <= 0) launch();
          return;
        }

        /* sub-step so a fast ball cannot tunnel through a brick */
        const steps = Math.max(1, Math.ceil((Math.hypot(ball.vx, ball.vy) * dt) / ballR));
        const sdt = dt / steps;

        for (let i = 0; i < steps; i++) {
          ball.x += ball.vx * sdt;
          if (smash()) {
            ball.x -= ball.vx * sdt;
            ball.vx = -ball.vx;
          }
          ball.y += ball.vy * sdt;
          if (smash()) {
            ball.y -= ball.vy * sdt;
            ball.vy = -ball.vy;
          }

          if (ball.x < ballR) {
            ball.x = ballR;
            ball.vx = Math.abs(ball.vx);
          }
          if (ball.x > W - ballR) {
            ball.x = W - ballR;
            ball.vx = -Math.abs(ball.vx);
          }
          if (ball.y < ballR) {
            ball.y = ballR;
            ball.vy = Math.abs(ball.vy);
          }

          if (ball.vy > 0 && touches(ball.x, ball.y, ballR, paddleX, paddleY, paddleW, paddleH)) {
            let offset = clamp((ball.x - (paddleX + paddleW / 2)) / (paddleW / 2), -1, 1);
            /* never let a dead-centre hit lock the ball into a vertical loop */
            if (Math.abs(offset) < 0.06) offset = ball.vx < 0 ? -0.06 : 0.06;
            const angle = -Math.PI / 2 + offset * 1.05;
            ball.vx = Math.cos(angle) * speed;
            ball.vy = Math.sin(angle) * speed;
            ball.y = paddleY - ballR;
          }

          if (ball.y > H + ballR) {
            lives -= 1;
            if (lives > 0) park();
            else api.over("Game over", again(score));
            return;
          }
        }

        if (!calm) {
          trail.unshift({ x: ball.x, y: ball.y });
          if (trail.length > 8) trail.pop();
        }

        if (!bricks.some((b) => b.alive)) api.over("Board cleared", again(score));
      },

      render(ctx) {
        for (const b of bricks) {
          if (!b.alive) continue;
          const tone = blend(theme.accent, theme.gold, b.row / (rows - 1));
          block(ctx, b.x, b.y, brickW, brickH, 3, tone, 9);
        }

        trail.forEach((p, i) => {
          const t = 1 - i / trail.length;
          ctx.globalAlpha = t * 0.22;
          dot(ctx, p.x, p.y, ballR * (0.4 + t * 0.6), theme.accent);
        });
        ctx.globalAlpha = 1;

        block(ctx, paddleX, paddleY, paddleW, paddleH, 4, theme.accent, 14);
        dot(ctx, ball.x, ball.y, ballR, theme.text, 12);
      },
    };
  }

  /* ---------- Snake ---------- */
  function snake() {
    const cell = 20;
    const cols = W / cell;
    const rows = H / cell;
    const headings = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    };

    let body = [];
    let heading = headings.ArrowRight;
    let queued = [];
    let food = { x: 0, y: 0 };
    let score = 0;
    let since = 0;
    let clock = 0;
    let latched = false;

    const pace = () => Math.max(70, 140 - Math.floor(score / 4) * 6);

    function occupied(x, y, ignoreTail) {
      const last = ignoreTail ? body.length - 1 : body.length;
      return body.slice(0, last).some((s) => s.x === x && s.y === y);
    }

    function dropFood() {
      const free = [];
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (!occupied(x, y)) free.push({ x, y });
        }
      }
      if (!free.length) return false;
      food = free[Math.floor(Math.random() * free.length)];
      return true;
    }

    function step(api) {
      if (queued.length) heading = queued.shift();
      const head = { x: body[0].x + heading.x, y: body[0].y + heading.y };
      const grew = head.x === food.x && head.y === food.y;

      if (
        head.x < 0 ||
        head.y < 0 ||
        head.x >= cols ||
        head.y >= rows ||
        occupied(head.x, head.y, !grew)
      ) {
        api.over("Game over", again(score));
        return;
      }

      body.unshift(head);
      if (!grew) {
        body.pop();
        return;
      }

      score += 1;
      if (!dropFood()) api.over("Board filled", again(score));
    }

    return {
      title: "Snake",
      hint: "click or press <b>S</b> to start",
      get score() {
        return score;
      },
      stats: () => ({ score, length: body.length }),

      reset() {
        body = [
          { x: 8, y: 8 },
          { x: 7, y: 8 },
          { x: 6, y: 8 },
        ];
        heading = headings.ArrowRight;
        queued = [];
        score = 0;
        since = 0;
        latched = false;
        dropFood();
      },

      key(k, down) {
        if (!down) return;
        const next = headings[k];
        if (!next) return;
        const current = queued.length ? queued[queued.length - 1] : heading;
        if (next.x === -current.x && next.y === -current.y) return;
        if (next.x === current.x && next.y === current.y) return;
        if (queued.length < 2) queued.push(next);
      },

      swipe(k) {
        this.key(k, true);
      },

      tilt(x, y) {
        const pull = Math.max(Math.abs(x), Math.abs(y));
        if (latched) {
          if (pull < 0.3) latched = false;
          return;
        }
        if (pull < 0.6) return;
        latched = true;
        this.key(
          Math.abs(x) > Math.abs(y)
            ? x > 0
              ? "ArrowRight"
              : "ArrowLeft"
            : y > 0
              ? "ArrowDown"
              : "ArrowUp",
          true,
        );
      },

      update(dt, api) {
        clock += dt;
        since += dt * 1000;
        let tick = pace();
        while (since >= tick && !api.ended) {
          since -= tick;
          step(api);
          tick = pace();
        }
      },

      render(ctx) {
        grid(ctx, cell);

        const pulse = calm ? 0 : Math.sin(clock * 5) * 1.1;
        block(
          ctx,
          food.x * cell + 4 - pulse / 2,
          food.y * cell + 4 - pulse / 2,
          cell - 8 + pulse,
          cell - 8 + pulse,
          3,
          theme.gold,
          14,
        );

        body.forEach((s, i) => {
          const t = body.length > 1 ? i / (body.length - 1) : 0;
          const tone = blend(theme.accent, theme.border, t * 0.72);
          block(ctx, s.x * cell + 2, s.y * cell + 2, cell - 4, cell - 4, 4, tone, i ? 0 : 12);
        });

        const head = body[0];
        if (head) {
          const cx = head.x * cell + cell / 2;
          const cy = head.y * cell + cell / 2;
          const ax = heading.y === 0 ? 3 : 4;
          const ay = heading.y === 0 ? 4 : 3;
          dot(ctx, cx + heading.x * 3 - (heading.y ? ax : 0), cy + heading.y * 3 - (heading.x ? ay : 0), 1.4, "#060910");
          dot(ctx, cx + heading.x * 3 + (heading.y ? ax : 0), cy + heading.y * 3 + (heading.x ? ay : 0), 1.4, "#060910");
        }
      },
    };
  }

  /* ---------- Board plumbing: state, loop, input ---------- */
  function mount(stage, game) {
    const canvas = stage.querySelector(".game-canvas");
    const ctx = canvas.getContext("2d");
    const overlay = stage.querySelector(".game-overlay");
    const title = overlay.querySelector(".overlay-title");
    const hint = overlay.querySelector(".overlay-hint");
    const panel = stage.closest("details");
    const readouts = {};
    stage.querySelectorAll("[data-hud]").forEach((el) => {
      readouts[el.dataset.hud] = el;
    });

    const tiltButton = stage.querySelector("[data-tilt]");
    const key = `bgreg.${stage.dataset.game}.best`;
    const readBest = () => {
      try {
        return Number(localStorage.getItem(key)) || 0;
      } catch {
        return 0;
      }
    };

    let best = readBest();
    let state = "idle";
    let frame = 0;
    let stamp = 0;
    let swipeFrom = null;
    let tilting = false;
    let neutral = null;
    let smooth = { x: 0, y: 0 };

    const api = {
      ended: false,
      over(heading, note) {
        api.ended = true;
        finish(heading, note);
      },
    };

    function show(heading, note) {
      title.textContent = heading;
      hint.innerHTML = note;
      overlay.hidden = false;
    }

    function sync() {
      if (game.score > best) {
        best = game.score;
        try {
          localStorage.setItem(key, String(best));
        } catch {}
      }
      const values = game.stats();
      values.best = best;
      for (const [name, el] of Object.entries(readouts)) {
        if (values[name] !== undefined) el.textContent = values[name];
      }
    }

    function paint() {
      ctx.clearRect(0, 0, W, H);
      game.render(ctx);
    }

    function fit() {
      const box = canvas.getBoundingClientRect();
      if (!box.width) return;
      const dpr = window.devicePixelRatio || 1;
      const width = Math.round(box.width * dpr);
      const height = Math.round(box.height * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      ctx.setTransform(width / W, 0, 0, height / H, 0, 0);
      paint();
    }

    function tick(now) {
      frame = requestAnimationFrame(tick);
      const dt = Math.min((now - stamp) / 1000, 0.05);
      stamp = now;
      api.ended = false;
      game.update(dt, api);
      sync();
      paint();
    }

    function run() {
      if (frame) return;
      stamp = performance.now();
      frame = requestAnimationFrame(tick);
    }

    function halt() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    }

    function idle() {
      halt();
      state = "idle";
      game.reset();
      sync();
      show(game.title, game.hint);
      paint();
    }

    function start() {
      if (state === "running") return;
      if (state !== "paused") {
        game.reset();
        sync();
      }
      state = "running";
      overlay.hidden = true;
      neutral = null;
      run();
    }

    function pause() {
      if (state !== "running") return;
      halt();
      state = "paused";
      show("Paused", "press <b>P</b> or click to resume");
      paint();
    }

    function finish(heading, note) {
      halt();
      state = "over";
      sync();
      show(heading, note);
      paint();
    }

    function orientation(e) {
      if (e.beta === null || e.gamma === null) return;
      if (state !== "running" && state !== "idle") return;
      if (!neutral) neutral = { beta: e.beta, gamma: e.gamma };

      /* the screen can be rotated under the device axes, so turn the tilt
         back into the board's own left/right and up/down */
      const spin = (((screen.orientation && screen.orientation.angle) || 0) * Math.PI) / 180;
      const cos = Math.cos(spin);
      const sin = Math.sin(spin);
      const sideways = e.gamma - neutral.gamma;
      const forwards = e.beta - neutral.beta;

      smooth.x += (sideways * cos - forwards * sin - smooth.x) * 0.3;
      smooth.y += (forwards * cos + sideways * sin - smooth.y) * 0.3;

      game.tilt(shape(smooth.x), shape(smooth.y));
      if (state === "idle") paint();
    }

    function setTilt(on) {
      tilting = on;
      neutral = null;
      smooth = { x: 0, y: 0 };
      tiltButton.setAttribute("aria-pressed", String(on));
      tiltButton.textContent = on ? "tilt on" : "tilt";
      window[on ? "addEventListener" : "removeEventListener"]("deviceorientation", orientation);
    }

    if (tiltButton && game.tilt && tiltAvailable()) {
      tiltButton.hidden = false;
      tiltButton.addEventListener("click", async () => {
        if (tilting) {
          setTilt(false);
          return;
        }
        /* the permission call has to start inside this tap */
        if (typeof DeviceOrientationEvent.requestPermission === "function") {
          let verdict = "denied";
          try {
            verdict = await DeviceOrientationEvent.requestPermission();
          } catch {
            verdict = "denied";
          }
          if (verdict !== "granted") {
            tiltButton.disabled = true;
            tiltButton.textContent = "tilt blocked";
            return;
          }
        }
        setTilt(true);
        canvas.focus({ preventScroll: true });
      });
    }

    const handled = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "s", "p"]);

    canvas.addEventListener("keydown", (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (!handled.has(k)) return;
      e.preventDefault();
      if (k === "s" || k === " ") start();
      else if (k === "p") (state === "running" ? pause : start)();
      else game.key(k, true);
    });

    canvas.addEventListener("keyup", (e) => {
      if (handled.has(e.key)) game.key(e.key, false);
    });

    canvas.addEventListener("pointerdown", (e) => {
      canvas.focus({ preventScroll: true });
      swipeFrom = { x: e.clientX, y: e.clientY };
      start();
    });

    canvas.addEventListener("pointerup", (e) => {
      if (!swipeFrom || !game.swipe) return;
      const dx = e.clientX - swipeFrom.x;
      const dy = e.clientY - swipeFrom.y;
      swipeFrom = null;
      if (Math.hypot(dx, dy) < 24) return;
      const horizontal = Math.abs(dx) > Math.abs(dy);
      game.swipe(
        horizontal
          ? dx > 0
            ? "ArrowRight"
            : "ArrowLeft"
          : dy > 0
            ? "ArrowDown"
            : "ArrowUp",
      );
    });

    canvas.addEventListener("pointermove", (e) => {
      if (!game.point) return;
      const box = canvas.getBoundingClientRect();
      game.point(((e.clientX - box.left) / box.width) * W);
      if (state !== "running") paint();
    });

    canvas.addEventListener("blur", pause);
    canvas.addEventListener("contextmenu", () => {
      swipeFrom = null;
    });

    if (panel) {
      panel.addEventListener("toggle", () => {
        if (panel.open) fit();
        else pause();
      });
    }

    new ResizeObserver(fit).observe(canvas);
    new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) pause();
    }).observe(canvas);

    idle();
  }

  const builders = { breakaway, snake };
  document.querySelectorAll(".game-stage").forEach((stage) => {
    const build = builders[stage.dataset.game];
    if (build) mount(stage, build());
  });
})();
