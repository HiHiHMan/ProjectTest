(() => {
  const image = document.querySelector(".spidy-image");
  const layer = document.querySelector(".spidy-image-layer");
  const canvas = layer?.querySelector(".spidy-pixel-canvas");
  const progress = document.querySelector(".pixel-progress");
  const progressFill = progress?.querySelector(".pixel-progress-fill");
  const progressValue = progress?.querySelector(".pixel-progress-value");
  const progressMessage = progress?.querySelector(".pixel-progress-message");
  if (!image || !layer || !canvas) return;

  const MAX_DOTS = 120000;
  let drawing = false;

  function updateProgress(percent, message) {
    const value = Math.max(0, Math.min(100, Math.round(percent)));
    if (progressFill) progressFill.style.width = value + "%";
    if (progressValue) progressValue.textContent = value + "%";
    if (progressMessage && message) progressMessage.textContent = message;
  }

  function finishProgress(message, failed = false) {
    updateProgress(failed ? 0 : 100, message);
    if (failed) {
      if (progress) progress.classList.add("is-error");
      return;
    }
    window.setTimeout(() => progress?.classList.add("is-hidden"), 900);
  }

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
      // สุ่มพิกัดทั่วทั้งภาพแทนการวางเป็นตาราง ให้กระจายเหมือนเม็ดทรายสี
      let particleIndex = 0;
      let drawn = 0;
      const chunkSize = 3000;
      const minDimension = Math.min(width, height);
      ctx.clearRect(0, 0, width, height);

      function drawChunk() {
        const endParticle = Math.min(MAX_DOTS, particleIndex + chunkSize);
        for (; particleIndex < endParticle; particleIndex++) {
          const sx = Math.floor(Math.random() * source.width);
          const sy = Math.floor(Math.random() * source.height);
          const index = (sy * source.width + sx) * 4;
          const alpha = imageData.data[index + 3] / 255;
          if (alpha < 0.04) continue;

          const x = (sx / source.width) * width;
          const y = (sy / source.height) * height;
          const radius = minDimension * (0.00045 + Math.random() * 0.0003);

          ctx.fillStyle = "rgba(" + imageData.data[index] + "," + imageData.data[index + 1] + "," + imageData.data[index + 2] + "," + alpha + ")";
          ctx.beginPath();
          ctx.arc(x, y, Math.max(0.35, radius), 0, Math.PI * 2);
          ctx.fill();
          drawn++;
        }

        const percent = 5 + (particleIndex / MAX_DOTS) * 95;
        updateProgress(percent, "กำลังสร้างเม็ดสี " + drawn.toLocaleString("th-TH") + " จุด...");
        if (particleIndex < MAX_DOTS) {
          requestAnimationFrame(drawChunk);
          return;
        }

        if (!drawn) throw new Error("ไม่พบ Pixel ที่มีสีในภาพ");
        image.style.opacity = "0";
        canvas.style.display = "block";
        finishProgress("สร้างจุดสีสำเร็จ " + drawn.toLocaleString("th-TH") + " จุด");
        console.info("Spider-Man pixel effect ready:", drawn, "dots");
        drawing = false;
      }
      requestAnimationFrame(drawChunk);
    } catch (error) {
      console.error("Spider-Man pixel effect failed:", error);
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
        requestAnimationFrame(renderDots);
      }
    }).observe(image);
  } else {
    window.addEventListener("resize", () => {
      if (!drawing) requestAnimationFrame(renderDots);
    });
  }
})();