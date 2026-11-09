(() => {
  const image = document.querySelector(".spidy-image");
  const layer = document.querySelector(".spidy-image-layer");
  const canvas = layer?.querySelector(".spidy-pixel-canvas");
  const progress = document.querySelector(".pixel-progress");
  const progressFill = progress?.querySelector(".pixel-progress-fill");
  const progressValue = progress?.querySelector(".pixel-progress-value");
  const progressMessage = progress?.querySelector(".pixel-progress-message");
  if (!image || !layer || !canvas) return;

  const MAX_DOTS = 12000;
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
      const aspect = width / height;
      const columns = Math.min(MAX_DOTS, Math.max(1, Math.round(Math.sqrt(MAX_DOTS * aspect))));
      const rows = Math.max(1, Math.floor(MAX_DOTS / columns));
      const cellW = width / columns;
      const cellH = height / rows;
      let row = 0;
      let drawn = 0;

      ctx.clearRect(0, 0, width, height);
      function drawChunk() {
        const endRow = Math.min(rows, row + 8);
        for (; row < endRow; row++) {
          for (let col = 0; col < columns; col++) {
            // สุ่มตำแหน่งภายในแต่ละช่อง เพื่อให้เม็ดสีดูเป็นธรรมชาติคล้ายเม็ดทราย
            const jitterX = Math.random();
            const jitterY = Math.random();
            const sx = Math.min(source.width - 1, Math.floor((col + jitterX) / columns * source.width));
            const sy = Math.min(source.height - 1, Math.floor((row + jitterY) / rows * source.height));
            const index = (sy * source.width + sx) * 4;
            const alpha = imageData.data[index + 3] / 255;
            if (alpha < 0.04) continue;

            const grainSize = Math.min(cellW, cellH) * (0.28 + Math.random() * 0.34);
            const x = (col + jitterX) * cellW;
            const y = (row + jitterY) * cellH;
            ctx.fillStyle = "rgba(" + imageData.data[index] + "," + imageData.data[index + 1] + "," + imageData.data[index + 2] + "," + alpha + ")";
            ctx.beginPath();
            ctx.arc(x, y, Math.max(0.3, grainSize), 0, Math.PI * 2);
            ctx.fill();
            drawn++;
          }
        }

        const percent = 5 + (row / rows) * 95;
        updateProgress(percent, "กำลังสร้างจุดสี " + drawn.toLocaleString("th-TH") + " จุด...");
        if (row < rows) {
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