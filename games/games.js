/* ---------- Games ----------
   Breakaway, Snake and the Game of Life, drawn straight onto the page in the
   site palette. Each board runs only while it is open, on screen, and focused. */
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

  /* ---------- Game of Life ----------
     Honest Conway for the first eighty generations. Then it hangs. */
  function life(stage) {
    const cell = 8;
    const cols = W / cell;
    const rows = H / cell;
    const GEN_RATE = 9;                     /* generations per second while the rules hold */
    const HANG_GEN = 80;                    /* the generation the simulation seems to freeze on */
    const STRIDE = 0.35;                    /* cells a glider travels per change of phase */

    /* the four phases of a south-east glider, read off the real rules;
       the other three headings are mirror images */
    const GLIDER = [
      [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]],
      [[0, 1], [2, 1], [1, 2], [2, 2], [1, 3]],
      [[2, 1], [0, 2], [2, 2], [1, 3], [2, 3]],
      [[1, 1], [2, 2], [3, 2], [1, 3], [2, 3]],
    ];

    const PATTERNS = {
      block: ["##", "##"],
      beehive: [".##.", "#..#", ".##."],
      loaf: [".##.", "#..#", ".#.#", "..#."],
      boat: ["##.", "#.#", ".#."],
      tub: [".#.", "#.#", ".#."],
      blinker: ["###"],
      toad: [".###", "###."],
      beacon: ["##..", "##..", "..##", "..##"],
      pulsar: [
        "..###...###..", ".............", "#....#.#....#", "#....#.#....#", "#....#.#....#",
        "..###...###..", ".............", "..###...###..", "#....#.#....#", "#....#.#....#",
        "#....#.#....#", ".............", "..###...###..",
      ],
    };

    /* the furniture, the five gliders and the soup are laid out so that
       nothing comes near a glider before the hang: a real simulation of the
       whole board agrees with the drawn one cell for cell up to that point */
    const FURNITURE = [
      ["pulsar", 40, 26], ["blinker", 10, 24], ["blinker", 46, 2], ["blinker", 30, 36],
      ["toad", 22, 8], ["beacon", 3, 16], ["block", 28, 8], ["block", 57, 38],
      ["block", 20, 38], ["block", 34, 10], ["beehive", 27, 2], ["loaf", 14, 2],
      ["boat", 26, 33], ["tub", 28, 12],
    ];
    const GLIDERS = [[5, 0, 1, 1], [0, 5, 1, 1], [57, 25, -1, -1], [52, 6, -1, 1], [14, 36, 1, -1]];
    const SOUP = { x: 1, y: 33, size: 6, density: 0.45 };
    const SOUP_SEEDS = [269, 369, 35, 96, 111, 355, 263, 169];

    const MESSAGES = ["YOU'RE NEXT", "MURDER", "NO ESCAPE", "RUN", "DON'T LOOK BACK", "IT'S BEHIND YOU"];
    const FONT = {
      A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14],
      D: [30, 17, 17, 17, 17, 17, 30], E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16],
      G: [14, 17, 16, 23, 17, 17, 14], H: [17, 17, 17, 31, 17, 17, 17], I: [14, 4, 4, 4, 4, 4, 14],
      J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
      M: [17, 27, 21, 21, 17, 17, 17], N: [17, 25, 21, 19, 17, 17, 17], O: [14, 17, 17, 17, 17, 17, 14],
      P: [30, 17, 17, 30, 16, 16, 16], Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17],
      S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4], U: [17, 17, 17, 17, 17, 17, 14],
      V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 27, 17], X: [17, 17, 10, 4, 10, 17, 17],
      Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
      "'": [1, 1, 2, 0, 0, 0, 0], " ": [0, 0, 0, 0, 0, 0, 0],
    };
    const GLYPH_WIDTH = { "'": 2, " ": 3 };

    const red = {
      villain: "#ff3b3b",
      deep: "#b3121b",
      gore: "#8e0f16",
      dried: "#4d0409",
      fresh: "#ff4a4a",
      flood: "#7d0b13",
      head: "#ff5555",
      letters: "#ff2626",
    };

    let board = new Uint8Array(cols * rows);
    let scratch = new Uint8Array(cols * rows);
    let bgCount = 0;
    let gen = 0;
    let since = 0;
    let frozen = false;
    let actors = [];
    let villain = null;
    let stains = [];
    let drips = [];
    let particles = [];
    let letters = [];
    let flood = null;
    let scene = "life";
    let t = 0;
    let freeze = 0;
    let flash = 0;
    let shake = 0;
    let dark = 0;
    let pulse = 0;
    let gliders = 0;
    let alive = 0;
    let clock = 0;
    let vignette = null;

    const rng = (state) => () => {
      state = (state + 0x6d2b79f5) | 0;
      let n = Math.imul(state ^ (state >>> 15), 1 | state);
      n = (n + Math.imul(n ^ (n >>> 7), 61 | n)) ^ n;
      return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
    };
    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
    const at = (x, y) => y * cols + x;

    function enter(next) {
      scene = next;
      t = 0;
      if (stage) stage.dataset.act = next;
      if (scenes[next].enter) scenes[next].enter();
    }

    /* ---- the honest part ---- */
    function seed() {
      const flipX = Math.random() < 0.5;
      const flipY = Math.random() < 0.5;
      const place = (x, y) => {
        board[at(flipX ? cols - 1 - x : x, flipY ? rows - 1 - y : y)] = 1;
      };
      board.fill(0);
      FURNITURE.forEach(([name, ox, oy]) => {
        PATTERNS[name].forEach((row, y) => {
          [...row].forEach((ch, x) => {
            if (ch === "#") place(ox + x, oy + y);
          });
        });
      });
      const soup = rng(pick(SOUP_SEEDS));
      for (let y = 0; y < SOUP.size; y++) {
        for (let x = 0; x < SOUP.size; x++) {
          if (soup() < SOUP.density) place(SOUP.x + x, SOUP.y + y);
        }
      }
      actors = GLIDERS.map(([x, y, dx, dy]) => ({
        x: flipX ? cols - 3 - x : x,
        y: flipY ? rows - 3 - y : y,
        dx: flipX ? -dx : dx,
        dy: flipY ? -dy : dy,
        phase: 0,
        size: 1,
        vx: 0,
        vy: 0,
        run: 0,
        speed: 0,
        blood: 0,
        fidget: 0,
        twitch: 0,
        tremble: 0,
        spooked: false,
        cornered: false,
        alive: true,
      }));
      bgCount = board.reduce((sum, v) => sum + v, 0);
    }

    function stepLife() {
      let count = 0;
      for (let y = 0; y < rows; y++) {
        const up = y > 0;
        const down = y < rows - 1;
        for (let x = 0; x < cols; x++) {
          const left = x > 0;
          const right = x < cols - 1;
          let n = 0;
          if (up) {
            if (left) n += board[at(x - 1, y - 1)];
            n += board[at(x, y - 1)];
            if (right) n += board[at(x + 1, y - 1)];
          }
          if (left) n += board[at(x - 1, y)];
          if (right) n += board[at(x + 1, y)];
          if (down) {
            if (left) n += board[at(x - 1, y + 1)];
            n += board[at(x, y + 1)];
            if (right) n += board[at(x + 1, y + 1)];
          }
          const next = n === 3 || (board[at(x, y)] && n === 2) ? 1 : 0;
          scratch[at(x, y)] = next;
          count += next;
        }
      }
      [board, scratch] = [scratch, board];
      bgCount = count;
    }

    function advanceGliders() {
      for (const a of actors) {
        a.phase = (a.phase + 1) % 4;
        if (a.phase === 0) {
          a.x += a.dx;
          a.y += a.dy;
        }
      }
    }

    /* ---- the characters ---- */
    const centre = (a) => ({ x: a.x + 1.5 * a.size, y: a.y + 1.5 * a.size });
    const gap = (a, b) => {
      const p = centre(a);
      const q = centre(b);
      return Math.hypot(p.x - q.x, p.y - q.y);
    };
    const living = () => actors.filter((a) => a.alive && a !== villain);

    function face(a, b) {
      const p = centre(a);
      const q = centre(b);
      a.dx = q.x >= p.x ? 1 : -1;
      a.dy = q.y >= p.y ? 1 : -1;
    }

    function steer(a, tx, ty, speed, dt, agility) {
      const m = Math.hypot(tx, ty) || 1;
      const k = Math.min(1, agility * dt);
      a.vx += ((tx / m) * speed - a.vx) * k;
      a.vy += ((ty / m) * speed - a.vy) * k;
    }

    function travel(a, dt, free) {
      const ox = a.x;
      const oy = a.y;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      if (!free) {
        a.x = clamp(a.x, 0, cols - 3 * a.size);
        a.y = clamp(a.y, 0, rows - 3 * a.size);
      }
      a.run += Math.hypot(a.x - ox, a.y - oy);
      const stride = STRIDE * a.size;
      while (a.run >= stride) {
        a.run -= stride;
        a.phase = (a.phase + 1) % 4;
      }
      if (Math.abs(a.vx) > 0.3) a.dx = Math.sign(a.vx);
      if (Math.abs(a.vy) > 0.3) a.dy = Math.sign(a.vy);
    }

    function flee(v, dt) {
      const p = centre(v);
      const q = centre(villain);
      const d = Math.hypot(p.x - q.x, p.y - q.y) || 1;
      let tx = (p.x - q.x) / d;
      let ty = (p.y - q.y) / d;
      const margin = 7;
      if (p.x < margin) tx += ((margin - p.x) / margin) * 1.5;
      if (p.x > cols - margin) tx -= ((p.x - cols + margin) / margin) * 1.5;
      if (p.y < margin) ty += ((margin - p.y) / margin) * 1.5;
      if (p.y > rows - margin) ty -= ((p.y - rows + margin) / margin) * 1.5;
      tx += (Math.random() - 0.5) * 0.7;
      ty += (Math.random() - 0.5) * 0.7;
      steer(v, tx, ty, v.speed, dt, 6);
      travel(v, dt);
    }

    function splat(p, vx, vy, count) {
      const aim = Math.atan2(vy, vx);
      for (let i = 0; i < count; i++) {
        const spread = (Math.random() + Math.random() - 1) * 1.4;
        const reach = 0.4 + Math.random() ** 0.8 * (3.2 + 2.2 * Math.cos(spread));
        const x = Math.round(p.x + Math.cos(aim + spread) * reach - 0.5);
        const y = Math.round(p.y + Math.sin(aim + spread) * reach - 0.5);
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        stains.push({ x, y, born: clock, tone: Math.random() });
      }
      stains.push({ x: Math.round(p.x - 0.5), y: Math.round(p.y - 0.5), born: clock, tone: 1 });
    }

    function kill(victim, count) {
      victim.alive = false;
      gliders -= 1;
      splat(centre(victim), villain.vx || 1, villain.vy || 1, count);
      flash = calm ? 0 : 0.14;
      shake = calm ? 0 : 0.4;
      freeze = 0.45;
      villain.vx = 0;
      villain.vy = 0;
      villain.rest = 0.6;
      living().forEach((v) => {
        v.spooked = true;
      });
    }

    /* ---- the writing on the wall ---- */
    function layout(text, scale) {
      const width = (s) => [...s].reduce((sum, ch, i) => sum + (GLYPH_WIDTH[ch] || 5) * scale + (i ? scale : 0), 0);
      const lines = [];
      let line = "";
      for (const word of text.split(" ")) {
        const trial = line ? `${line} ${word}` : word;
        if (width(trial) <= cols - 4) line = trial;
        else {
          if (line) lines.push(line);
          line = word;
        }
      }
      if (line) lines.push(line);
      const height = lines.length * 7 * scale + (lines.length - 1) * 2 * scale;
      if (scale > 1 && (height > rows - 8 || lines.some((words) => width(words) > cols - 4))) return layout(text, 1);

      const cells = [];
      const top = Math.round((rows - height) / 2);
      lines.forEach((words, row) => {
        let x = Math.round((cols - width(words)) / 2);
        const y = top + row * 9 * scale;
        for (const ch of words) {
          const glyph = FONT[ch] || FONT[" "];
          const w = GLYPH_WIDTH[ch] || 5;
          glyph.forEach((bits, gy) => {
            for (let gx = 0; gx < w; gx++) {
              if (!(bits & (1 << (w - 1 - gx)))) continue;
              for (let sy = 0; sy < scale; sy++) {
                for (let sx = 0; sx < scale; sx++) cells.push([x + gx * scale + sx, y + gy * scale + sy]);
              }
            }
          });
          x += (w + 1) * scale;
        }
      });
      return cells;
    }

    function gather() {
      const sources = [];
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (board[at(x, y)]) sources.push([x, y]);
      stains.forEach((s) => sources.push([s.x, s.y]));
      GLIDER[villain.phase].forEach(([gx, gy]) => {
        const x = Math.round(villain.x + (villain.dx > 0 ? gx : 2 - gx) * 2);
        const y = Math.round(villain.y + (villain.dy > 0 ? gy : 2 - gy) * 2);
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) sources.push([x + dx, y + dy]);
      });
      letters = layout(pick(MESSAGES), 2);
      while (sources.length < letters.length) {
        sources.push([Math.floor(Math.random() * cols), -1 - Math.floor(Math.random() * 6)]);
      }
      const spare = new Set();
      while (spare.size < sources.length - letters.length) spare.add(Math.floor(Math.random() * sources.length));
      sources.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const targets = letters.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      let next = 0;
      particles = sources.map((from, index) => {
        const gone = spare.has(index);
        const to = gone ? [from[0], rows + 2 + Math.random() * 6] : targets[next++];
        return { from, to, gone, delay: Math.random() * 0.5, span: 1.1 + Math.random() * 0.4 };
      });
      stains = [];
      board.fill(0);
      bgCount = 0;
    }

    function bleed() {
      const bottoms = letters.filter(([x, y]) => !letters.some(([ox, oy]) => ox === x && oy === y + 1));
      if (!bottoms.length) return;
      const [x, y] = pick(bottoms);
      drips.push({ x, y: y + 1, length: 2 + Math.floor(Math.random() * 6), grown: 0, pace: 0.08 + Math.random() * 0.1, wait: 0 });
    }

    /* ---- the story, one scene at a time ---- */
    const scenes = {
      life: {
        tick(dt) {
          since += dt * 1000;
          const tick = 1000 / GEN_RATE;
          while (since >= tick && !frozen) {
            since -= tick;
            stepLife();
            advanceGliders();
            gen += 1;
            if (gen >= HANG_GEN) {
              frozen = true;
              enter("hang");
            }
          }
        },
      },
      hang: {
        tick() {
          if (t > 1.2) enter("meet");
        },
      },
      meet: {
        enter() {
          villain = actors[0];
          villain.fidget = 0.7;
          actors[1].fidget = 0.7;
        },
        tick() {
          const other = actors[1];
          if (t > 0.8 && !villain.turned) {
            villain.turned = true;
            face(villain, other);
            face(other, villain);
            villain.phase = 0;
            other.phase = 0;
          }
          if (t > 1.4 && !villain.stepped) {
            villain.stepped = true;
            villain.x += villain.dx;
            villain.y += villain.dy;
            villain.phase = 1;
          }
          if (t > 1.7 && t < 1.9) other.fidget = 0.2;
          if (t > 2.3) enter("reveal");
        },
      },
      reveal: {
        enter() {
          villain.x0 = villain.x;
          villain.y0 = villain.y;
        },
        tick() {
          const other = actors[1];
          villain.blood = Math.min(5, Math.floor(t / 0.14) + 1);
          if (t > 0.75 && !other.backed) {
            other.backed = true;
            other.x = clamp(other.x - other.dx, 0, cols - 3);
            other.y = clamp(other.y - other.dy, 0, rows - 3);
            other.phase = 2;
          }
          if (t > 0.9 && !villain.grown) {
            villain.size = 1 + ease(Math.min(1, (t - 0.9) / 0.55));
            villain.x = villain.x0 - 1.5 * (villain.size - 1);
            villain.y = villain.y0 - 1.5 * (villain.size - 1);
          }
          if (t > 1.45 && !villain.grown) {
            villain.grown = true;
            villain.size = 2;
            villain.x = clamp(villain.x0 - 1.5, 0, cols - 6);
            villain.y = clamp(villain.y0 - 1.5, 0, rows - 6);
            flash = calm ? 0 : 0.1;
            other.tremble = 0.6;
          }
          if (t > 2.1) {
            other.spooked = true;
            villain.speed = 7.5;
            villain.lunge = 12;
            villain.rest = 0;
            villain.target = other;
            living().forEach((v) => {
              v.speed = 5 + Math.random() * 0.6;
            });
            enter("chase");
          }
        },
      },
      chase: {
        tick(dt) {
          pulse = 0.08 + 0.08 * (4 - living().length);
          if (freeze > 0) return;
          villain.speed = Math.min(9, villain.speed + dt * 0.4);
          for (const v of living()) {
            if (!v.spooked && gap(v, villain) < 13) v.spooked = true;
            if (v.spooked) flee(v, dt);
          }
          if (villain.rest > 0) {
            villain.rest -= dt;
            villain.fidget = 0.1;
            return;
          }
          if (!villain.target || !villain.target.alive) {
            const left = living();
            if (!left.length) {
              enter("finale");
              return;
            }
            if (left.length === 1) {
              enter("corner");
              return;
            }
            villain.target = left.sort((a, b) => gap(a, villain) - gap(b, villain))[0];
          }
          const p = centre(villain);
          const q = centre(villain.target);
          const d = Math.hypot(q.x - p.x, q.y - p.y);
          const near = d < 8 || t > 16;
          steer(villain, q.x - p.x, q.y - p.y, near ? villain.lunge : villain.speed, dt, near ? 9 : 4);
          travel(villain, dt);
          if (gap(villain, villain.target) < 2.6) kill(villain.target, 16 + Math.floor(Math.random() * 8));
        },
      },
      corner: {
        enter() {
          const prey = living()[0];
          const p = centre(villain);
          const q = centre(prey);
          const corners = [[1, 1], [cols - 4, 1], [1, rows - 4], [cols - 4, rows - 4]];
          const refuge = (c) => Math.hypot(c[0] - p.x, c[1] - p.y) - 1.4 * Math.hypot(c[0] - q.x, c[1] - q.y);
          prey.goal = corners.sort((a, b) => refuge(b) - refuge(a))[0];
          prey.speed = 9;
          prey.spooked = true;
          villain.target = prey;
          villain.stage = "stalk";
          villain.held = 0;
        },
        tick(dt) {
          pulse = 0.4;
          if (freeze > 0) return;
          const prey = villain.target;
          const reach = Math.hypot(prey.goal[0] - prey.x, prey.goal[1] - prey.y);
          if (reach > 0.4 && !prey.cornered) {
            steer(prey, prey.goal[0] - prey.x, prey.goal[1] - prey.y, prey.speed, dt, 8);
            travel(prey, dt);
          } else {
            prey.cornered = true;
            prey.vx = 0;
            prey.vy = 0;
            prey.tremble = 0.2;
            face(prey, villain);
          }
          const p = centre(villain);
          const q = centre(prey);
          const d = Math.hypot(q.x - p.x, q.y - p.y);
          if (villain.stage === "stalk") {
            const pace = prey.cornered ? (d > 10 ? 6.5 : 3.5) : clamp((d - 8) * 1.5, 2, 8);
            steer(villain, q.x - p.x, q.y - p.y, pace, dt, 4);
            travel(villain, dt);
            if (prey.cornered && (d < 10 || t > 7)) {
              villain.stage = "stare";
              villain.vx = 0;
              villain.vy = 0;
              face(villain, prey);
            }
          } else if (villain.stage === "stare") {
            villain.held += dt;
            if (villain.held > 0.5 && villain.held < 0.7) villain.fidget = 0.2;
            if (villain.held > 1.2) villain.stage = "lunge";
          } else {
            steer(villain, q.x - p.x, q.y - p.y, 15, dt, 14);
            travel(villain, dt);
          }
          if (t > 12) villain.stage = "lunge";
          if (gap(villain, prey) < 2.6) {
            kill(prey, 30);
            enter("finale");
          }
        },
      },
      finale: {
        enter() {
          flood = Array.from({ length: cols }, () => ({
            delay: Math.random() * 0.7,
            speed: rows / (1 + Math.random() * 0.8),
            front: 0,
          }));
          villain.vx = 0;
          villain.vy = 0;
          villain.fidget = 0;
        },
        tick() {
          if (freeze > 0) return;
          const tau = t - 0.8;
          if (tau < 0) return;
          pulse = 0.4 + 0.6 * Math.min(1, tau / 1.2);
          if (!calm) shake = 0.2;
          flood.forEach((d) => {
            d.front = Math.max(0, (tau - d.delay) * d.speed);
          });
          if (tau > 3) {
            flood = null;
            shake = 0;
            dark = 1;
            gather();
            enter("morph");
          }
        },
      },
      morph: {
        tick() {
          pulse = 0.35;
          if (t > 2.1) {
            particles = [];
            villain.x = cols + 1;
            villain.y = rows - 8;
            villain.dx = -1;
            villain.dy = -1;
            villain.vx = 0;
            villain.vy = 0;
            villain.phase = 0;
            enter("message");
          }
        },
      },
      message: {
        tick(dt, api) {
          pulse = 0.5;
          if (t > 0.3 && drips.length < 14 && Math.random() < dt * 2.4) bleed();
          drips.forEach((d) => {
            d.wait += dt;
            while (d.wait >= d.pace && d.grown < d.length) {
              d.wait -= d.pace;
              d.grown += 1;
            }
          });
          const seat = cols - 8;
          if (t > 1.2 && villain.x > seat) {
            villain.vx = -5.5;
            travel(villain, dt, true);
            if (villain.x <= seat) {
              villain.x = seat;
              villain.vx = 0;
              villain.dx = -1;
              villain.dy = -1;
              villain.phase = 0;
            }
          } else if (t > 3.6 && t < 3.8) villain.fidget = 0.15;
          if (t > 6) api.over("Happy Halloween", "click or press <b>S</b> to run it again");
        },
      },
    };

    function count() {
      let n = bgCount + stains.length + letters.length;
      for (const a of actors) if (a.alive) n += a.size > 1.5 ? 20 : 5;
      if (flood) flood.forEach((d) => { n += Math.min(rows, Math.floor(d.front)); });
      drips.forEach((d) => { n += d.grown; });
      return n;
    }

    /* ---- drawing ---- */
    function square(ctx, x, y, color, size = 1) {
      ctx.fillStyle = color;
      ctx.fillRect(x * cell + 1, y * cell + 1, cell * size - 2, cell * size - 2);
    }

    function drawGlider(ctx, a) {
      const size = a.size;
      const whole = size === 1 || size === 2;
      const wobble = a.tremble > 0 && !calm ? (Math.random() - 0.5) * 4 : 0;
      ctx.save();
      ctx.translate(wobble, wobble * 0.6);
      GLIDER[a.phase].forEach(([gx, gy], index) => {
        const x = a.x + (a.dx > 0 ? gx : 2 - gx) * size;
        const y = a.y + (a.dy > 0 ? gy : 2 - gy) * size;
        const color = a === villain && index < a.blood ? red.villain : theme.accent;
        square(ctx, whole ? Math.round(x) : x, whole ? Math.round(y) : y, color, size);
      });
      ctx.restore();
    }

    function beat(s) {
      const thump = (offset) => Math.exp(-(((((s - offset) % 0.9) + 0.9) % 0.9 / 0.11) ** 2));
      return thump(0) + 0.55 * thump(0.22);
    }

    return {
      title: "Game of Life",
      hint: "click or press <b>S</b> to start",
      get score() {
        return 0;
      },
      stats: () => ({ gen, alive, gliders }),

      reset() {
        gen = 0;
        since = 0;
        frozen = false;
        villain = null;
        stains = [];
        drips = [];
        particles = [];
        letters = [];
        flood = null;
        freeze = 0;
        flash = 0;
        shake = 0;
        dark = 0;
        pulse = 0;
        clock = 0;
        gliders = GLIDERS.length;
        seed();
        alive = count();
        enter("life");
      },

      key() {},

      update(dt, api) {
        clock += dt;
        t += dt;
        if (freeze > 0) freeze -= dt;
        if (flash > 0) flash -= dt;
        if (shake > 0) shake -= dt;
        for (const a of actors) {
          if (a.fidget > 0) {
            a.fidget -= dt;
            a.twitch += dt;
            if (a.twitch > 0.12) {
              a.twitch = 0;
              a.phase = (a.phase + 1) % 4;
            }
          }
          if (a.tremble > 0) a.tremble -= dt;
        }
        scenes[scene].tick(dt, api);
        alive = count();
      },

      render(ctx) {
        ctx.save();
        if (shake > 0 && !calm) ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4);

        if (dark > 0) {
          ctx.fillStyle = `rgba(3, 0, 2, ${dark})`;
          ctx.fillRect(-8, -8, W + 16, H + 16);
        } else {
          grid(ctx, cell);
          ctx.fillStyle = flood ? red.flood : theme.accent;
          for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
              if (board[at(x, y)]) ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
            }
          }
        }

        if (flood) {
          flood.forEach((d, x) => {
            const whole = Math.floor(Math.min(rows, d.front));
            for (let y = 0; y < whole; y++) {
              square(ctx, x, y, y === whole - 1 ? red.head : blend(red.flood, red.deep, ((x * 7 + y * 13) % 5) / 5));
            }
          });
        }

        for (const s of stains) {
          const age = clock - s.born;
          square(ctx, s.x, s.y, age < 1.5 ? blend(red.fresh, red.gore, age / 1.5) : blend(red.gore, red.dried, s.tone * 0.6));
        }

        for (const p of particles) {
          const k = ease(clamp((t - p.delay) / p.span, 0, 1));
          const x = Math.round(p.from[0] + (p.to[0] - p.from[0]) * k);
          const y = Math.round(p.from[1] + (p.to[1] - p.from[1]) * k);
          if (y >= 0 && y < rows) square(ctx, x, y, p.gone ? red.gore : red.letters);
        }

        if (scene === "message") {
          letters.forEach(([x, y]) => square(ctx, x, y, red.letters));
          drips.forEach((d) => {
            for (let i = 0; i < d.grown; i++) square(ctx, d.x, d.y + i, i === d.grown - 1 ? red.fresh : red.gore);
          });
        }

        for (const a of actors) {
          if (a.alive && !(scene === "morph" && a === villain)) drawGlider(ctx, a);
        }

        if (pulse > 0) {
          if (!vignette) {
            vignette = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 330);
            vignette.addColorStop(0, "rgba(120, 0, 8, 0)");
            vignette.addColorStop(1, "rgba(120, 0, 8, 1)");
          }
          ctx.globalAlpha = Math.min(1, pulse * (0.18 + 0.5 * beat(clock)));
          ctx.fillStyle = vignette;
          ctx.fillRect(-8, -8, W + 16, H + 16);
          ctx.globalAlpha = 1;
        }

        if (flash > 0) {
          ctx.fillStyle = `rgba(255, 236, 236, ${Math.min(0.9, flash * 7)})`;
          ctx.fillRect(-8, -8, W + 16, H + 16);
        }
        ctx.restore();
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

  const builders = { breakaway, snake, life };
  document.querySelectorAll(".game-stage").forEach((stage) => {
    const build = builders[stage.dataset.game];
    if (build) mount(stage, build(stage));
  });
})();
