/* =====================================================
   script.js — WebGL volumetric smog overlay (Three.js)
   Custom GLSL particle shader, procedural fractal noise,
   curl-driven swirling, cinematic air-quality palette.
   ===================================================== */

(function () {
    'use strict';

    const CDN_URLS = [
        'https://unpkg.com/three@0.160.0/build/three.module.js',
        'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js',
        'https://esm.sh/three@0.160.0',
    ];

    async function loadThree() {
        for (const url of CDN_URLS) {
            try { return await import(url); } catch (_) { /* try next */ }
        }
        throw new Error('Unable to load three.js from any CDN');
    }

    function ready(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
        } else {
            fn();
        }
    }

    ready(async () => {
        const canvas = document.getElementById('smogCanvas');
        if (!canvas) return;
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const dpr = window.devicePixelRatio || 1;
        const lowCoreDevice = (navigator.hardwareConcurrency || 4) <= 4;
        const lowMemoryDevice = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4;
        const isLikelyLowEnd = lowCoreDevice || lowMemoryDevice || dpr > 2;
        const quality = {
            particleCount: prefersReducedMotion ? 180 : (isLikelyLowEnd ? 320 : 460),
            noiseSize: prefersReducedMotion ? 96 : (isLikelyLowEnd ? 128 : 192),
            noiseOctaves: prefersReducedMotion ? 3 : 4,
            pixelRatioCap: prefersReducedMotion ? 0.9 : (isLikelyLowEnd ? 1.0 : 1.25),
            targetFps: prefersReducedMotion ? 24 : (isLikelyLowEnd ? 30 : 45),
        };

        let THREE;
        try { THREE = await loadThree(); }
        catch (e) { console.error('[smog]', e); return; }

        /* ---------- procedural tileable fBm noise texture ---------- */
        function makeNoiseTexture(size = 256, octaves = 5) {
            const c = document.createElement('canvas');
            c.width = c.height = size;
            const cx = c.getContext('2d');
            const img = cx.createImageData(size, size);

            const perm = new Uint8Array(512);
            const idx = Array.from({ length: 256 }, (_, i) => i);
            for (let i = 255; i > 0; i--) {
                const j = (Math.random() * (i + 1)) | 0;
                [idx[i], idx[j]] = [idx[j], idx[i]];
            }
            for (let i = 0; i < 512; i++) perm[i] = idx[i & 255];

            const lerp = (a, b, t) => a + (b - a) * t;
            const fade = (t) => t * t * (3 - 2 * t);

            function vnoise(x, y, period) {
                const xi = Math.floor(x), yi = Math.floor(y);
                const xf = x - xi, yf = y - yi;
                const x0 = ((xi % period) + period) % period;
                const y0 = ((yi % period) + period) % period;
                const x1 = (x0 + 1) % period, y1 = (y0 + 1) % period;
                const a = perm[perm[x0] + y0] / 255;
                const b = perm[perm[x1] + y0] / 255;
                const c = perm[perm[x0] + y1] / 255;
                const d = perm[perm[x1] + y1] / 255;
                const u = fade(xf), v = fade(yf);
                return lerp(lerp(a, b, u), lerp(c, d, u), v);
            }

            const period = 8;
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    let val = 0, amp = 0.5, freq = 1;
                    for (let o = 0; o < octaves; o++) {
                        val += amp * vnoise(x / size * period * freq, y / size * period * freq, period * freq);
                        freq *= 2; amp *= 0.5;
                    }
                    const v = Math.max(0, Math.min(255, val * 255));
                    const i = (y * size + x) * 4;
                    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
                    img.data[i + 3] = 255;
                }
            }
            cx.putImageData(img, 0, 0);

            const tex = new THREE.CanvasTexture(c);
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.generateMipmaps = false;
            return tex;
        }

        /* ---------- renderer / scene / camera ---------- */
        const renderer = new THREE.WebGLRenderer({
            canvas,
            alpha: true,
            antialias: false,
            premultipliedAlpha: false,
            powerPreference: 'high-performance',
        });
        renderer.setClearColor(0x000000, 0);
        renderer.setPixelRatio(Math.min(dpr, quality.pixelRatioCap));

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        camera.position.z = 1;

        /* ---------- particle field (instanced quads) ---------- */
        const COUNT = quality.particleCount;
        const positions = new Float32Array(COUNT * 3);
        const seeds = new Float32Array(COUNT);
        const sizes = new Float32Array(COUNT);
        const tints = new Float32Array(COUNT);
        const speeds = new Float32Array(COUNT);

        for (let i = 0; i < COUNT; i++) {
            positions[i * 3 + 0] = (Math.random() * 2 - 1) * 2.0;
            positions[i * 3 + 1] = (Math.random() * 2 - 1) * 1.3;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
            seeds[i] = Math.random() * 1000;
            sizes[i] = 0.35 + Math.pow(Math.random(), 1.6) * 1.55;
            tints[i] = Math.random();
            speeds[i] = (Math.random() < 0.5 ? -1 : 1) * (0.04 + Math.random() * 0.10);
        }

        const baseQuad = new THREE.PlaneGeometry(1, 1);
        const geom = new THREE.InstancedBufferGeometry();
        geom.index = baseQuad.index;
        geom.setAttribute('position', baseQuad.attributes.position);
        geom.setAttribute('uv', baseQuad.attributes.uv);
        geom.setAttribute('iCenter', new THREE.InstancedBufferAttribute(positions, 3));
        geom.setAttribute('iSeed',   new THREE.InstancedBufferAttribute(seeds, 1));
        geom.setAttribute('iSize',   new THREE.InstancedBufferAttribute(sizes, 1));
        geom.setAttribute('iTint',   new THREE.InstancedBufferAttribute(tints, 1));
        geom.setAttribute('iSpeed',  new THREE.InstancedBufferAttribute(speeds, 1));
        geom.instanceCount = COUNT;

        const vertexShader = /* glsl */`
            uniform float uTime;
            uniform float uAspect;

            attribute vec3  iCenter;
            attribute float iSeed;
            attribute float iSize;
            attribute float iTint;
            attribute float iSpeed;

            varying vec2  vUv;
            varying float vSeed;
            varying float vTint;
            varying float vAlphaPulse;

            // hash + value noise for curl-like flow
            vec2 h22(vec2 p) {
                p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
                return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
            }
            float vn(vec2 p) {
                vec2 i = floor(p), f = fract(p);
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(mix(dot(h22(i + vec2(0,0)), f - vec2(0,0)),
                               dot(h22(i + vec2(1,0)), f - vec2(1,0)), u.x),
                           mix(dot(h22(i + vec2(0,1)), f - vec2(0,1)),
                               dot(h22(i + vec2(1,1)), f - vec2(1,1)), u.x), u.y);
            }

            void main() {
                float t = uTime * 0.001;

                // base center + horizontal drift (with wraparound)
                vec2 center = iCenter.xy;
                center.x += iSpeed * t;
                center.x = mod(center.x + uAspect + 1.0, 2.0 * uAspect + 2.0) - uAspect - 1.0;

                // curl-noise displacement → swirling fluid motion
                float ts = t * 0.35 + iSeed;
                vec2 q = center * 0.7 + iSeed * 0.13;
                float nx = vn(q + vec2(ts, 0.0));
                float ny = vn(q + vec2(0.0, ts));
                center += vec2(nx, ny) * 0.18;

                // vertical bob
                center.y += sin(t * 0.6 + iSeed * 5.0) * 0.04;

                // per-particle rotation (rotational velocity)
                float angVel = (sin(iSeed * 13.0) * 0.5 + 0.55) * 0.25;
                float ang = t * angVel + iSeed * 6.2831;
                float ca = cos(ang), sa = sin(ang);
                mat2 rot = mat2(ca, -sa, sa, ca);

                vec2 quad = rot * (position.xy * iSize);

                vec3 worldPos = vec3(center + quad, iCenter.z);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);

                vUv = uv;
                vSeed = iSeed;
                vTint = iTint;
                vAlphaPulse = 0.55 + 0.45 * sin(t * 0.9 + iSeed * 7.0);
            }
        `;

        const fragmentShader = /* glsl */`
            precision highp float;
            uniform sampler2D uNoise;
            uniform float uTime;

            varying vec2  vUv;
            varying float vSeed;
            varying float vTint;
            varying float vAlphaPulse;

            vec3 paletteMix(float t) {
                // Cinematic air-quality grading
                vec3 charcoal = vec3(0.16, 0.17, 0.18);
                vec3 ash      = vec3(0.34, 0.33, 0.30);
                vec3 sulfur   = vec3(0.55, 0.60, 0.22);
                vec3 amber    = vec3(0.78, 0.46, 0.13);
                vec3 rust     = vec3(0.42, 0.24, 0.12);
                if (t < 0.25)      return mix(charcoal, ash,    t / 0.25);
                else if (t < 0.50) return mix(ash,      sulfur, (t - 0.25) / 0.25);
                else if (t < 0.75) return mix(sulfur,   amber,  (t - 0.50) / 0.25);
                else               return mix(amber,    rust,   (t - 0.75) / 0.25);
            }

            void main() {
                vec2 p = vUv - 0.5;
                float r = length(p);
                float mask = smoothstep(0.5, 0.05, r);
                if (mask <= 0.001) discard;

                float t = uTime * 0.00012;
                vec2 ouv = vUv * 1.3 + vSeed * 0.37;

                // domain-warped fBm via two texture taps
                vec2 warp = vec2(
                    texture2D(uNoise, ouv * 0.6 + vec2(t,        0.0)).r,
                    texture2D(uNoise, ouv * 0.6 + vec2(0.0,      t)).r
                ) - 0.5;

                float n1 = texture2D(uNoise, ouv          + warp * 0.55 + vec2(t * 1.3, -t)).r;
                float n2 = texture2D(uNoise, ouv * 2.1    + warp * 0.30 + vec2(-t,  t * 1.7)).r;
                float n3 = texture2D(uNoise, ouv * 4.3    + warp * 0.18).r;
                float n  = n1 * 0.55 + n2 * 0.30 + n3 * 0.15;

                // wispy edges + dense pockets via contrast curve
                float density = pow(n, 1.5) * mask;

                vec3 col = paletteMix(vTint);
                // subtle internal shadowing for volumetric depth
                col *= mix(0.65, 1.20, n);

                float alpha = density * (0.30 + vAlphaPulse * 0.35);
                gl_FragColor = vec4(col * alpha, alpha);
            }
        `;

        const material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                uTime:    { value: 0 },
                uNoise:   { value: makeNoiseTexture(quality.noiseSize, quality.noiseOctaves) },
                uAspect:  { value: 1 },
            },
            transparent: true,
            depthWrite: false,
            depthTest: false,
            blending: THREE.CustomBlending,
            blendEquation: THREE.AddEquation,
            blendSrc: THREE.OneFactor,                  // premultiplied src
            blendDst: THREE.OneMinusSrcAlphaFactor,     // standard alpha over
        });

        const mesh = new THREE.Mesh(geom, material);
        mesh.frustumCulled = false;
        scene.add(mesh);

        /* ---------- responsive sizing ---------- */
        function resize() {
            const w = window.innerWidth, h = window.innerHeight;
            const aspect = w / h;
            renderer.setSize(w, h, false);
            camera.left = -aspect; camera.right = aspect;
            camera.top = 1;        camera.bottom = -1;
            camera.updateProjectionMatrix();
            material.uniforms.uAspect.value = aspect;
        }
        resize();

        let resizeTimer = 0;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(resize, 120);
        });

        /* ---------- main loop ---------- */
        let running = true;
        document.addEventListener('visibilitychange', () => {
            running = !document.hidden;
            if (running) { last = performance.now(); requestAnimationFrame(frame); }
        });

        let last = performance.now();
        const frameInterval = 1000 / quality.targetFps;
        function frame(now) {
            if (!running) return;
            const dt = Math.min(now - last, 50);
            if (dt < frameInterval) {
                requestAnimationFrame(frame);
                return;
            }
            last = now;
            material.uniforms.uTime.value += dt;
            renderer.render(scene, camera);
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    });
})();
