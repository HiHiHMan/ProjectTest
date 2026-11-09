const canvas = document.querySelector("#webgl-web");
const stage = document.querySelector(".spidy-stage");

if (canvas && stage) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const random = (min, max) => min + Math.random() * (max - min);

  function drawFallbackWeb() {
    const fallback = document.createElement("canvas");
    fallback.className = "web-fallback";
    fallback.setAttribute("aria-hidden", "true");
    stage.insertBefore(fallback, canvas.nextSibling);
    const ctx = fallback.getContext("2d");

    function draw() {
      const rect = stage.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      fallback.width = Math.round(rect.width * dpr);
      fallback.height = Math.round(rect.height * dpr);
      fallback.style.width = rect.width + "px";
      fallback.style.height = rect.height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);

      for (let i = 0; i < 260; i++) {
        const x = random(-rect.width * .1, rect.width * 1.1);
        const y = random(-rect.height * .1, rect.height * 1.1);
        const length = random(55, Math.max(rect.width, rect.height) * .48);
        const angle = random(0, Math.PI * 2);
        const bend = random(-45, 45);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + Math.cos(angle) * length * .5 + bend, y + Math.sin(angle) * length * .5, x + Math.cos(angle) * length, y + Math.sin(angle) * length + bend);
        ctx.strokeStyle = i % 3 ? "rgba(195,231,255,.7)" : "rgba(255,255,255,.62)";
        ctx.lineWidth = random(.8, 1.8);
        ctx.shadowColor = "#9bdcff";
        ctx.shadowBlur = 6;
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }
    draw();
    window.addEventListener("resize", draw, { passive: true });
  }

  try {
    const THREE = await import("https://cdn.jsdelivr.net/npm/three@0.166.1/build/three.module.js");
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "low-power"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, .1, 100);
    camera.position.set(0, 0, 25);
    const nest = new THREE.Group();
    scene.add(nest);
    const palette = [0xe8f6ff, 0xb8e4ff, 0xd7e7f5, 0x9ac9ed];

    function addStrand(points, z, opacity, radius) {
      const curve = new THREE.CatmullRomCurve3(
        points.map(p => new THREE.Vector3(p[0], p[1], p[2] || 0)),
        false, "catmullrom", .5
      );
      const geometry = new THREE.TubeGeometry(curve, 32, radius, 5, false);
      const material = new THREE.MeshBasicMaterial({
        color: palette[Math.floor(Math.random() * palette.length)],
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = z;
      nest.add(mesh);
    }

    function buildNest(aspect) {
      const w = 12.8 * aspect;
      const h = 12.8;
      const layers = [
        { z: -5, count: 75, opacity: .58, radius: .018 },
        { z: 0, count: 95, opacity: .76, radius: .024 },
        { z: 5, count: 65, opacity: .56, radius: .019 }
      ];

      for (const layer of layers) {
        for (let i = 0; i < layer.count; i++) {
          const x1 = random(-w, w), y1 = random(-h, h);
          const x2 = random(-w, w), y2 = random(-h, h);
          const dx = x2 - x1, dy = y2 - y1;
          const bend = random(-3.2, 3.2);
          addStrand([
            [x1, y1, random(-.5, .5)],
            [x1 + dx * .32 + bend, y1 + dy * .28 + random(-2, 2), random(-.5, .5)],
            [x1 + dx * .68 - bend, y1 + dy * .72 + random(-2, 2), random(-.5, .5)],
            [x2, y2, random(-.5, .5)]
          ], layer.z, layer.opacity * random(.7, 1.2), layer.radius * random(.7, 1.35));
        }

        for (let i = 0; i < layer.count * 2; i++) {
          const x = random(-w, w), y = random(-h, h);
          addStrand([
            [x, y, 0],
            [x + random(-2.8, 2.8), y + random(-2.8, 2.8), random(-.4, .4)],
            [x + random(-5.5, 5.5), y + random(-4.5, 4.5), 0]
          ], layer.z + random(-.2, .2), layer.opacity * .72, layer.radius * .78);
        }
      }
    }

    function resize() {
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    }

    resize();
    buildNest(camera.aspect);

    const pointer = { x: 0, y: 0 };
    stage.addEventListener("pointermove", event => {
      const rect = stage.getBoundingClientRect();
      pointer.x = (event.clientX / rect.width - .5) * .22;
      pointer.y = -(event.clientY / rect.height - .5) * .16;
    }, { passive: true });

    window.addEventListener("resize", resize, { passive: true });
    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const t = clock.getElapsedTime();
      if (!reducedMotion) {
        nest.rotation.y += (pointer.x - nest.rotation.y) * .012;
        nest.rotation.x += (pointer.y - nest.rotation.x) * .012;
        nest.rotation.z = Math.sin(t * .12) * .006;
      }
      renderer.render(scene, camera);
    });
  } catch (error) {
    canvas.style.display = "none";
    console.warn("WebGL unavailable; showing 2D spider-web fallback.", error);
    drawFallbackWeb();
  }
}
