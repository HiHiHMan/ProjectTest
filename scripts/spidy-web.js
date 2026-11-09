import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.166.1/build/three.module.js";

const canvas = document.querySelector("#webgl-web");
const stage = document.querySelector(".spidy-stage");

if (canvas && stage) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "low-power"
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
  camera.position.set(0, 0, 18);

  const webRoot = new THREE.Group();
  scene.add(webRoot);

  const random = (min, max) => min + Math.random() * (max - min);
  const colors = [0xc7e5f7, 0x8fc9ed, 0xd9dce8, 0x9eb8d2];

  function addStrand(points, layer, strength = 1) {
    const curve = new THREE.CatmullRomCurve3(
      points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
      false,
      "catmullrom",
      0.35
    );
    const geometry = new THREE.TubeGeometry(curve, Math.max(18, points.length * 5), random(0.006, 0.014), 4, false);
    const material = new THREE.MeshBasicMaterial({
      color: colors[Math.floor(Math.random() * colors.length)],
      transparent: true,
      opacity: random(0.13, 0.34) * strength,
      depthWrite: false
    });
    const strand = new THREE.Mesh(geometry, material);
    strand.position.z = layer;
    webRoot.add(strand);
  }

  function buildWeb() {
    const aspect = stage.clientWidth / Math.max(stage.clientHeight, 1);
    const width = 18 * aspect;
    const height = 18;
    const layers = [
      { z: -3.5, count: 58, strength: 0.7, spread: 1 },
      { z: 0.8, count: 48, strength: 0.9, spread: 0.92 },
      { z: 4.2, count: 24, strength: 0.48, spread: 0.82 }
    ];

    for (const layer of layers) {
      // Long, irregular threads crossing the scene from edge to edge.
      for (let i = 0; i < layer.count; i++) {
        const horizontal = Math.random() > 0.5;
        const start = horizontal
          ? [-width * 0.62, random(-height * 0.58, height * 0.58)]
          : [random(-width * 0.62, width * 0.62), height * 0.62];
        const end = horizontal
          ? [width * 0.62, random(-height * 0.58, height * 0.58)]
          : [random(-width * 0.62, width * 0.62), -height * 0.62];
        const points = [];
        const segments = Math.floor(random(3, 7));

        for (let j = 0; j <= segments; j++) {
          const t = j / segments;
          points.push([
            THREE.MathUtils.lerp(start[0], end[0], t) + random(-2.5, 2.5) * layer.spread,
            THREE.MathUtils.lerp(start[1], end[1], t) + random(-2.1, 2.1) * layer.spread,
            random(-0.9, 0.9)
          ]);
        }
        addStrand(points, layer.z, layer.strength);
      }

      // Short, broken-looking connectors create the tangled nest texture.
      for (let i = 0; i < Math.floor(layer.count * 1.45); i++) {
        const x = random(-width * 0.62, width * 0.62);
        const y = random(-height * 0.62, height * 0.62);
        const points = [
          [x, y, random(-1, 1)],
          [x + random(-4.5, 4.5), y + random(-3.5, 3.5), random(-1, 1)],
          [x + random(-7, 7), y + random(-6, 6), random(-1, 1)]
        ];
        addStrand(points, layer.z + random(-0.35, 0.35), layer.strength * 0.8);
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

  buildWeb();
  resize();

  let pointerX = 0;
  let pointerY = 0;
  stage.addEventListener("pointermove", (event) => {
    const rect = stage.getBoundingClientRect();
    pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 0.45;
    pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 0.3;
  }, { passive: true });

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const time = clock.getElapsedTime();
    if (!reducedMotion) {
      webRoot.rotation.y += (pointerX - webRoot.rotation.y) * 0.012;
      webRoot.rotation.x += (-pointerY - webRoot.rotation.x) * 0.012;
      webRoot.rotation.z = Math.sin(time * 0.16) * 0.004;
    }
    renderer.render(scene, camera);
  });

  window.addEventListener("resize", resize, { passive: true });
}
