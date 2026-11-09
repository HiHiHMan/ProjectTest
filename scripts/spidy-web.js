(() => {
  const image = document.querySelector(".spidy-image");
  const layer = document.querySelector(".spidy-image-layer");
  const canvas = layer?.querySelector(".spidy-pixel-canvas");
  const progress = document.querySelector(".pixel-progress");
  const progressFill = progress?.querySelector(".pixel-progress-fill");
  const progressValue = progress?.querySelector(".pixel-progress-value");
  const progressMessage = progress?.querySelector(".pixel-progress-message");
  if (!image || !layer || !canvas) return;

  const MAX_DOTS = 20000;
  const CHUNK_SIZE = 3000;
  const INTERACTION_RADIUS = 145;
  const PUSH_STRENGTH = 1.9;
  const RETURN_STRENGTH = 0.075;
  const FRICTION = 0.86;

  let drawing = false;
  let particles = null;
  let animationFrame = 0;
  let pointer = { x: -10000, y: -10000, active: false };

  function updateProgress(percent, message) {
    const value = Math.max(0, Math.min(100, Math.round(percent)));
    if (progressFill) progressFill.style.width = value + "%";
    if (progressValue) progressValue.textContent = value + "%";
    if (progressMessage && message) progressMessage.textContent = message;
  }

  function finishProgress(message, failed = false) {
    updateProgress(failed ? 0 : 100, message);
    if (failed) {
      progress?.classList.add("is-error");
      return;
    }
    window.setTimeout(() => progress?.classList.add("is-hidden"), 900);
  }

  function drawParticles() {
    if (!particles) return;
    const { ctx, width, height, x, y, vx, vy, radius, red, green, blue, alpha, count } = particles;
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < count; i++) {
      ctx.fillStyle = "rgba(" + red[i] + "," + green[i] + "," + blue[i] + "," + alpha[i] + ")";
      ctx.beginPath();
      ctx.arc(x[i], y[i], radius[i], 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function animateParticles() {
    animationFrame = 0;
    if (!particles) return;

    const { width, height, x, y, baseX, baseY, vx, vy, radius, red, green, blue, alpha, count, ctx } = particles;
    let moving = false;
    const radiusSq = INTERACTION_RADIUS * INTERACTION_RADIUS;

    for (let i = 0; i < count; i++) {
      let dx = x[i] - pointer.x;
      let dy = y[i] - pointer.y;
      const distSq = dx * dx + dy * dy;

      if (pointer.active && distSq < radiusSq && distSq > 0.01) {
        const distance = Math.sqrt(distSq);
        const force = (1 - distance / INTERACTION_RADIUS) * PUSH_STRENGTH;
        vx[i] += (dx / distance) * force;
        vy[i] += (dy / distance) * force;
      }

      vx[i] += (baseX[i] - x[i]) * RETURN_STRENGTH;
      vy[i] += (baseY[i] - y[i]) * RETURN_STRENGTH;
      vx[i] *= FRICTION;
      vy[i] *= FRICTION;
      x[i] += vx[i];
      y[i] += vy[i];

      if (Math.abs(baseX[i] - x[i]) > 0.15 || Math.abs(baseY[i] - y[i]) > 0.15 ||
          Math.abs(vx[i]) > 0.03 || Math.abs(vy[i]) > 0.03) moving = true;
    }

    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = "rgba(" + red[i] + "," + green[i] + "," + blue[i] + "," + alpha[i] + ")";
      ctx.beginPath();
      ctx.arc(x[i], y[i], radius[i], 0, Math.PI * 2);
      ctx.fill();
    }

    if (moving || pointer.active) {
      animationFrame = requestAnimationFrame(animateParticles);
    }
  }

  function wakeParticles() {
    if (particles && !animationFrame) animationFrame = requestAnimationFrame(animateParticles);
  }

  function handlePointerMove(event) {
    if (!particles) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    pointer.x = (event.clientX - rect.left) * scaleX;
    pointer.y = (event.clientY - rect.top) * scaleY;
    pointer.active = true;
    wakeParticles();
  }

  function handlePointerLeave() {
    pointer.active = false;
    pointer.x = -10000;
    pointer.y = -10000;
    wakeParticles();
  }

  window.addEventListener("pointermove", handlePointerMove, { passive: true });
  window.addEventListener("pointerup", handlePointerLeave, { passive: true });
  window.addEventListener("blur", handlePointerLeave);

  function renderDots() {
    if (drawing || !image.complete || !image.naturalWidth) return;
    drawing = true;
    updateProgress(0, "กำลังเตรียมภาพ...");

    try {
      const rect = image.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        drawing = false;
        requestAnimationFrame(renderDots);
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      canvas.width = width;
      canvas.height = height;
      canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:4;display:block;pointer-events:none";

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("ไม่สามารถสร้าง Canvas 2D ได้");

      const source = document.createElement("canvas");
      source.width = image.naturalWidth;
      source.height = image.naturalHeight;
      const sourceCtx = source.getContext("2d", { willReadFrequently: true });
      if (!sourceCtx) throw new Error("ไม่สามารถอ่านภาพต้นฉบับได้");
      sourceCtx.drawImage(image, 0, 0);

      updateProgress(5, "กำลังอ่านค่าสีจากภาพ...");
      const imageData = sourceCtx.getImageData(0, 0, source.width, source.height);
      const data = {
        ctx, width, height, count: 0,
        x: new Float32Array(MAX_DOTS), y: new Float32Array(MAX_DOTS),
        baseX: new Float32Array(MAX_DOTS), baseY: new Float32Array(MAX_DOTS),
        vx: new Float32Array(MAX_DOTS), vy: new Float32Array(MAX_DOTS),
        radius: new Float32Array(MAX_DOTS),
        red: new Uint8Array(MAX_DOTS), green: new Uint8Array(MAX_DOTS),
        blue: new Uint8Array(MAX_DOTS), alpha: new Float32Array(MAX_DOTS)
      };

      let particleIndex = 0;
      const minDimension = Math.min(width, height);

      function drawChunk() {
        const endParticle = Math.min(MAX_DOTS, particleIndex + CHUNK_SIZE);
        for (; particleIndex < endParticle; particleIndex++) {
          const sx = Math.floor(Math.random() * source.width);
          const sy = Math.floor(Math.random() * source.height);
          const pixel = (sy * source.width + sx) * 4;
          const a = imageData.data[pixel + 3] / 255;
          if (a < 0.04) continue;

          const i = data.count++;
          const px = (sx / source.width) * width;
          const py = (sy / source.height) * height;
          data.x[i] = data.baseX[i] = px;
          data.y[i] = data.baseY[i] = py;
          data.radius[i] = Math.max(0.6, minDimension * (0.0009 + Math.random() * 0.0005));
          data.red[i] = imageData.data[pixel];
          data.green[i] = imageData.data[pixel + 1];
          data.blue[i] = imageData.data[pixel + 2];
          data.alpha[i] = a;
        }

        const percent = 5 + (particleIndex / MAX_DOTS) * 95;
        updateProgress(percent, "กำลังสร้างเม็ดสี " + data.count.toLocaleString("th-TH") + " จุด...");
        if (particleIndex < MAX_DOTS) {
          requestAnimationFrame(drawChunk);
          return;
        }

        if (!data.count) throw new Error("ไม่พบ Pixel ที่มีสีในภาพ");
        particles = data;
        drawParticles();
        image.style.opacity = "0";
        canvas.style.display = "block";
        finishProgress("สร้างเม็ดสีสำเร็จ " + data.count.toLocaleString("th-TH") + " จุด");
        console.info("Spider-Man particle interaction ready:", data.count, "particles");
        drawing = false;
      }

      requestAnimationFrame(drawChunk);
    } catch (error) {
      console.error("Spider-Man particle effect failed:", error);
      image.style.opacity = "1";
      canvas.style.display = "none";
      finishProgress("ทำไม่สำเร็จ: " + (error.message || "เกิดข้อผิดพลาด"), true);
      drawing = false;
    }
  }

  image.style.opacity = "1";
  if (image.complete && image.naturalWidth) {
    requestAnimationFrame(renderDots);
  } else {
    image.addEventListener("load", () => requestAnimationFrame(renderDots), { once: true });
    image.addEventListener("error", () => finishProgress("โหลด obj02.webp ไม่สำเร็จ", true), { once: true });
  }

  if ("ResizeObserver" in window) {
    new ResizeObserver(() => {
      if (!drawing && image.complete && image.naturalWidth) {
        progress?.classList.remove("is-hidden");
        particles = null;
        requestAnimationFrame(renderDots);
      }
    }).observe(image);
  } else {
    window.addEventListener("resize", () => {
      if (!drawing) {
        particles = null;
        requestAnimationFrame(renderDots);
      }
    });
  }
})();