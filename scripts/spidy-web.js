(() => {
  const image = document.querySelector(".spidy-image");
  const layer = document.querySelector(".spidy-image-layer");
  const canvas = layer?.querySelector(".spidy-pixel-canvas");
  if (!image || !layer || !canvas) return;

  const MAX_DOTS = 1000;
  let drawing = false;

  function renderDots() {
    if (drawing || !image.complete || !image.naturalWidth) return;
    drawing = true;

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

      const aspect = width / height;
      const columns = Math.min(MAX_DOTS, Math.max(1, Math.round(Math.sqrt(MAX_DOTS * aspect))));
      const rows = Math.max(1, Math.floor(MAX_DOTS / columns));
      const cellW = width / columns;
      const cellH = height / rows;
      const imageData = sourceCtx.getImageData(0, 0, source.width, source.height);
      let drawn = 0;

      ctx.clearRect(0, 0, width, height);
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          const sx = Math.min(source.width - 1, Math.floor((col + 0.5) / columns * source.width));
          const sy = Math.min(source.height - 1, Math.floor((row + 0.5) / rows * source.height));
          const index = (sy * source.width + sx) * 4;
          const alpha = imageData.data[index + 3] / 255;
          if (alpha < 0.04) continue;

          ctx.fillStyle = "rgba(" + imageData.data[index] + "," + imageData.data[index + 1] + "," + imageData.data[index + 2] + "," + alpha + ")";
          ctx.beginPath();
          ctx.arc((col + 0.5) * cellW, (row + 0.5) * cellH, Math.max(1, Math.min(cellW, cellH) * 0.46), 0, Math.PI * 2);
          ctx.fill();
          drawn++;
        }
      }

      if (!drawn) throw new Error("ไม่พบ Pixel ที่มีสีในภาพ");
      image.style.opacity = "0";
      canvas.style.display = "block";
      console.info("Spider-Man pixel effect ready:", drawn, "dots");
    } catch (error) {
      console.error("Spider-Man pixel effect failed:", error);
      image.style.opacity = "1";
      canvas.style.display = "none";
    } finally {
      drawing = false;
    }
  }

  image.style.opacity = "1";
  if (image.complete && image.naturalWidth) {
    requestAnimationFrame(renderDots);
  } else {
    image.addEventListener("load", () => requestAnimationFrame(renderDots), { once: true });
  }

  if ("ResizeObserver" in window) {
    new ResizeObserver(() => requestAnimationFrame(renderDots)).observe(image);
  } else {
    window.addEventListener("resize", () => requestAnimationFrame(renderDots));
  }
})();