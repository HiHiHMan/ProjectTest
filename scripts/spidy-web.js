const canvas = document.querySelector("#webgl-web");
const stage = document.querySelector(".spidy-stage");

if (canvas && stage) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const random = (min, max) => min + Math.random() * (max - min);

  // Always draw a visible 2D web first; it also acts as a fallback if WebGL/CDN is unavailable.
  const ctx = canvas.getContext("2d");
  let fallbackWeb = [];

  function resizeCanvas() {
    const rect = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    createFallbackWeb(rect.width, rect.height);
    return rect;
  }

  function createFallbackWeb(width, height) {
    fallbackWeb = [];
    const colors = ["rgba(225,244,255,.78)", "rgba(145,207,245,.72)", "rgba(255,255,255,.58)"];
    for (let i = 0; i < 190; i++) {
      const points = [];
      const x = random(-width * .12, width * 1.12);
      const y = random(-height * .12, height * 1.12);
      const length = random(45, Math.max(width, height) * .42);
      const angle = random(0, Math.PI * 2);
      const bend = random(-1, 1);
      points.push([x, y]);
      points.push([x + Math.cos(angle) * length * .48 + bend * 25, y + Math.sin(angle) * length * .48]);
      points.push([x + Math.cos(angle) * length, y + Math.sin(angle) * length + bend * 30]);
      fallbackWeb.push({ points, color: colors[Math.floor(Math.random() * colors.length)], width: random(.7, 1.8), alpha: random(.35, .8) });
    }
  }

  function drawFallback() {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    ctx.clearRect(0, 0, width, height);
    for (const strand of fallbackWeb) {
      ctx.beginPath();
      ctx.moveTo(...strand.points[0]);
      ctx.quadraticCurveTo(...strand.points[1], ...strand.points[2]);
      ctx.strokeStyle = strand.color;
      ctx.globalAlpha = strand.alpha;
      ctx.lineWidth = strand.width;
      ctx.shadowColor = "#9bdcff";
      ctx.shadowBlur = 5;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  let dimensions = resizeCanvas();
  drawFallback();

  try {
    const THREE = await import("https://cdn.jsdelivr.net/npm/three@0.166.1/build/three.module.js");
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, dimensions.width / dimensions.height, .1, 100);
    camera.position.set(0, 0, 25);
    const nest = new THREE.Group();
    scene.add(nest);

    const palette = [0xe8f6ff, 0xb8e4ff, 0xd7e7f5, 0x9ac9ed];

    function strand(points, z, opacity, radius) {
      const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], p[1], p[2] || 0)), false, "catmullrom", .5);
      const geometry = new THREE.TubeGeometry(curve, 32, radius, 5, false);
      const material = new THREE.MeshBasicMaterial({
        color: palette[Math.floor(Math.random() * palette.length)],
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.z += z;
      nest.add(mesh);
    }

    function buildNest() {
      const w = 12.8 * camera.aspect;
      const h = 12.8;
      const layers = [
        { z: -5, count: 100, opacity: .56, radius: .018 },
        { z: 0, count: 125, opacity: .72, radius: .022 },
        { z: 5, count: 75, opacity: .48, radius: .016 }
      ];

      for (const layer of layers) {
        // Long, slack strands running in chaotic directions.
        for (let i = 0; i < layer.count; i++) {
          const x1 = random(-w, w), y1 = random(-h, h);
          const x2 = random(-w, w), y2 = random(-h, h);
          const dx = x2 - x1, dy = y2 - y1;
          const bend = random(-3.2, 3.2);
          const points = [
            [x1, y1, random(-.5, .5)],
            [x1 + dx * .32 + bend, y1 + dy * .28 + random(-2, 2), random(-.5, .5)],
            [x1 + dx * .68 - bend, y1 + dy * .72 + random(-2, 2), random(-.5, .5)],
            [x2, y2, random(-.5, .5)]
          ];
          strand(points, layer.z, layer.opacity * random(.7, 1.2), layer.radius * random(.7, 1.35));
        }

        // Loose knots and short connecting fibers.
        for (let i = 0; i < layer.count * 2; i++) {
          const x = random(-w, w), y = random(-h, h);
          const points = [
            [x, y, 0],
            [x + random(-2.8, 2.8), y + random(-2.8, 2.8), random(-.4, .4)],
            [x + random(-5.5, 5.5), y + random(-4.5, 4.5), 0]
          ];
          strand(points, layer.z + random(-.2, .2), layer.opacity * .72, layer.radius * .78);
        }
      }
    }

    buildNest();
    const pointer = { x: 0, y: 0 };
    stage.addEventListener("pointermove", event => {
      const rect = stage.getBoundingClientRect();
      pointer.x = (event.clientX / rect.width - .5) * .22;
      pointer.y = -(event.clientY / rect.height - .5) * .16;
    }, { passive: true });

    function onResize() {
      dimensions = resizeCanvas();
      renderer.setSize(dimensions.width, dimensions.height, false);
      camera.aspect = dimensions.width / dimensions.height;
      camera.updateProjectionMatrix();
      drawFallback();
    }
    renderer.setSize(dimensions.width, dimensions.height, false);
    window.addEventListener("resize", onResize, { passive: true });

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
    // Keep the already-drawn canvas web visible when WebGL is blocked or unavailable.
    drawFallback();
    console.warn("3D web unavailable; using canvas fallback.", error);
  }

  window.addEventListener("resize", () => {
    if (!canvas.dataset.webglReady) drawFallback();
  }, { passive: true });
}
