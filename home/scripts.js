/* =====================================================
           Atmospheric Smog — HTML5 Canvas
           Layered radial gradients drifting through 2D
           value-noise fields, with subtle mouse parallax.
           ===================================================== */

        (function () {
            const canvas = document.getElementById('smogCanvas');
            const ctx = canvas.getContext('2d');

            const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            let W = 0, H = 0, DPR = 1;

            function resize() {
                DPR = Math.min(window.devicePixelRatio || 1, 2);
                W = window.innerWidth;
                H = window.innerHeight;
                canvas.width  = W * DPR;
                canvas.height = H * DPR;
                canvas.style.width  = W + 'px';
                canvas.style.height = H + 'px';
                ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
            }
            resize();
            window.addEventListener('resize', resize);

            /* ---- Lightweight 2D value-noise (hash-based) ---- */
            function hash(x, y) {
                let n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
                return n - Math.floor(n);
            }
            const smooth = (t) => t * t * (3 - 2 * t);
            function noise2D(x, y) {
                const xi = Math.floor(x), yi = Math.floor(y);
                const xf = x - xi,        yf = y - yi;
                const a = hash(xi,     yi);
                const b = hash(xi + 1, yi);
                const c = hash(xi,     yi + 1);
                const d = hash(xi + 1, yi + 1);
                const u = smooth(xf), v = smooth(yf);
                return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
            }

            /* ---- Smog blob definitions ---- */
            const palette = [
                { r: 245, g: 235, b: 215 },  // warm dusty ivory
                { r: 230, g: 195, b: 145 },  // polluted amber
                { r: 190, g: 210, b: 228 },  // hazy blue-grey sky
                { r: 215, g: 220, b: 218 },  // pearl ash
                { r: 200, g: 185, b: 170 },  // warm grey haze
                { r: 175, g: 200, b: 195 },  // cool mint mist
            ];

            /* Mid-size drifting smog blobs — screen-spanning volumetric */
            const BLOBS = 22;
            const blobs = Array.from({ length: BLOBS }, (_, i) => {
                const c = palette[i % palette.length];
                return {
                    bx: Math.random(),
                    by: Math.random(),
                    radius: 600 + Math.random() * 400,
                    color: c,
                    alpha: 0.035 + Math.random() * 0.045,
                    nOff: Math.random() * 1000,
                    speed: 0.04 + Math.random() * 0.07,
                    depth: 0.35 + Math.random() * 0.85,
                    phase: Math.random() * Math.PI * 2,
                };
            });

            /* Mega-haze: screen-spanning volumetric sky-fill clouds */
            const MEGA = 6;
            const mega = Array.from({ length: MEGA }, (_, i) => {
                const c = palette[i % palette.length];
                return {
                    bx: Math.random(),
                    by: 0.2 + Math.random() * 0.6,
                    radius: 1200 + Math.random() * 800,
                    color: c,
                    alpha: 0.028 + Math.random() * 0.032,
                    nOff: Math.random() * 1000,
                    speed: 0.010 + Math.random() * 0.014,
                    depth: 0.12 + Math.random() * 0.28,
                    phase: Math.random() * Math.PI * 2,
                };
            });

            /* Wisps: elongated bright streaks rolling across the sky */
            const WISPS = 14;
            const wisps = Array.from({ length: WISPS }, () => ({
                x: Math.random() * 1.4 - 0.2,
                y: Math.random(),
                r: 250 + Math.random() * 350,
                a: 0.03 + Math.random() * 0.05,
                vx: 0.00014 + Math.random() * 0.00028,
                ph: Math.random() * Math.PI * 2,
                tone: Math.random() < 0.5 ? 0 : 1,
            }));

            /* Floating dust motes for foreground depth */
            const DUST = 70;
            const dust = Array.from({ length: DUST }, () => ({
                x: Math.random(), y: Math.random(),
                r: 0.4 + Math.random() * 1.1,
                a: 0.08 + Math.random() * 0.20,
                vx: (Math.random() - 0.5) * 0.00012,
                vy: -0.00008 - Math.random() * 0.00018,
                ph: Math.random() * Math.PI * 2,
            }));

            /* ---- Mouse parallax ---- */
            const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

            window.addEventListener('mousemove', (e) => {
                mouse.tx = e.clientX / W;
                mouse.ty = e.clientY / H;
            }, { passive: true });

            window.addEventListener('mouseleave', () => {
                mouse.tx = 0.5; mouse.ty = 0.5;
            });

            window.addEventListener('touchmove', (e) => {
                if (e.touches[0]) {
                    mouse.tx = e.touches[0].clientX / W;
                    mouse.ty = e.touches[0].clientY / H;
                }
            }, { passive: true });

            /* ---- Render loop ---- */
            let t = 0;
            const SPEED = prefersReduced ? 0.05 : 1;

            /* Helper to render a radial smog cloud — 4-stop volumetric falloff */
            function drawCloud(x, y, r, color, alpha) {
                const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
                const { r: cr, g: cg, b: cb } = color;
                grad.addColorStop(0,    `rgba(${cr},${cg},${cb},${alpha.toFixed(3)})`);
                grad.addColorStop(0.30, `rgba(${cr},${cg},${cb},${(alpha * 0.72).toFixed(3)})`);
                grad.addColorStop(0.62, `rgba(${cr},${cg},${cb},${(alpha * 0.22).toFixed(3)})`);
                grad.addColorStop(1,    `rgba(${cr},${cg},${cb},0)`);
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            }

            function frame() {
                t += 0.0042 * SPEED;

                mouse.x += (mouse.tx - mouse.x) * 0.045;
                mouse.y += (mouse.ty - mouse.y) * 0.045;
                const px = (mouse.x - 0.5) * 2;  // -1 .. 1
                const py = (mouse.y - 0.5) * 2;

                /* Clear — canvas is composited via mix-blend-mode: screen
                   over the photographic backdrop, so we keep it transparent. */
                ctx.clearRect(0, 0, W, H);

                ctx.globalCompositeOperation = 'screen';

                /* Pass 1: Mega-haze — gigantic slow drifting clouds */
                for (let i = 0; i < MEGA; i++) {
                    const m = mega[i];
                    const nx = noise2D(m.nOff + t * m.speed,        i * 1.3);
                    const ny = noise2D(i * 1.3,        m.nOff + t * m.speed * 0.7);

                    const driftX = (nx - 0.5) * 0.7;
                    const driftY = (ny - 0.5) * 0.4;

                    const x = (m.bx + driftX) * W - px * 22 * m.depth;
                    const y = (m.by + driftY) * H - py * 16 * m.depth;

                    const r = m.radius + Math.sin(t * 0.28 + m.phase) * 160;
                    const breath = 0.88 + Math.sin(t * 0.32 + m.phase) * 0.12;

                    drawCloud(x, y, r, m.color, m.alpha * breath);
                }

                /* Pass 2: Mid-size drifting smog blobs */
                for (let i = 0; i < BLOBS; i++) {
                    const b = blobs[i];

                    const nx = noise2D(b.nOff + t * b.speed,        i * 0.7);
                    const ny = noise2D(i * 0.7,        b.nOff + t * b.speed * 0.8);

                    const driftX = (nx - 0.5) * 0.55;
                    const driftY = (ny - 0.5) * 0.55;

                    const bob = Math.sin(t * 0.6 + b.phase) * 0.02;

                    const x = (b.bx + driftX) * W - px * 38 * b.depth;
                    const y = (b.by + driftY + bob) * H - py * 26 * b.depth;

                    const r = b.radius + Math.sin(t * 0.9 + b.phase) * 60;
                    const breath = 0.85 + Math.sin(t * 0.7 + b.phase) * 0.18;

                    drawCloud(x, y, r, b.color, b.alpha * breath);
                }

                /* Pass 3: Wisps — thin streaks rolling left → right */
                for (let i = 0; i < WISPS; i++) {
                    const w = wisps[i];
                    w.x += w.vx;
                    if (w.x > 1.25) {
                        w.x = -0.25;
                        w.y = Math.random();
                        w.r = 90 + Math.random() * 160;
                    }
                    const sway = Math.sin(t * 0.8 + w.ph) * 0.015;
                    const x = w.x * W - px * 18;
                    const y = (w.y + sway) * H - py * 10;
                    const r = w.r + Math.sin(t * 1.2 + w.ph) * 30;

                    const tint = w.tone === 0
                        ? { r: 238, g: 244, b: 248 }   // cool pearl sky
                        : { r: 248, g: 228, b: 195 };  // warm amber mist
                    drawCloud(x, y, r, tint, w.a);
                }

                ctx.globalCompositeOperation = 'screen';

                /* Pass 4: Floating dust motes */
                for (let i = 0; i < DUST; i++) {
                    const d = dust[i];
                    d.x += d.vx + Math.sin(t * 0.4 + d.ph) * 0.00015;
                    d.y += d.vy;
                    if (d.y < -0.05) { d.y = 1.05; d.x = Math.random(); }
                    if (d.x < -0.05) d.x = 1.05;
                    if (d.x >  1.05) d.x = -0.05;

                    const x = d.x * W - px * 12;
                    const y = d.y * H - py * 8;
                    const flicker = 0.6 + Math.sin(t * 2 + d.ph) * 0.4;

                    ctx.fillStyle = `rgba(240, 230, 210, ${(d.a * flicker).toFixed(3)})`;
                    ctx.beginPath();
                    ctx.arc(x, y, d.r, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.globalCompositeOperation = 'source-over';

                requestAnimationFrame(frame);
            }

            requestAnimationFrame(frame);
        })();
