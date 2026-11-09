(() => {
  const image = document.querySelector(".spidy-image");
  const layer = document.querySelector(".spidy-image-layer");
  const canvas = layer?.querySelector(".spidy-pixel-canvas");
  if (!image || !layer || !canvas) return;

  const MAX_DOTS = 1000;
  let fallbackCanvas = null;

  function getGrid(width, height) {
    const aspect = width / height;
    const columns = Math.max(1, Math.round(Math.sqrt(MAX_DOTS * aspect)));
    const rows = Math.max(1, Math.floor(MAX_DOTS / columns));
    return { columns, rows };
  }

  function drawFallback(error) {
    console.warn("WebGL unavailable; using 2D dot fallback.", error);
    try {
      fallbackCanvas ||= document.createElement("canvas");
      fallbackCanvas.className = "spidy-pixel-canvas spidy-pixel-fallback";
      fallbackCanvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:2;pointer-events:none";
      if (!fallbackCanvas.isConnected) layer.appendChild(fallbackCanvas);

      const rect = image.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      fallbackCanvas.width = Math.max(1, Math.round(rect.width * dpr));
      fallbackCanvas.height = Math.max(1, Math.round(rect.height * dpr));
      const ctx = fallbackCanvas.getContext("2d");
      const source = document.createElement("canvas");
      source.width = image.naturalWidth;
      source.height = image.naturalHeight;
      const sourceCtx = source.getContext("2d", { willReadFrequently: true });
      sourceCtx.drawImage(image, 0, 0);
      const { columns, rows } = getGrid(fallbackCanvas.width, fallbackCanvas.height);
      const cellW = fallbackCanvas.width / columns;
      const cellH = fallbackCanvas.height / rows;
      const data = sourceCtx.getImageData(0, 0, source.width, source.height);
      ctx.clearRect(0, 0, fallbackCanvas.width, fallbackCanvas.height);

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          const sx = Math.min(source.width - 1, Math.floor((col + 0.5) / columns * source.width));
          const sy = Math.min(source.height - 1, Math.floor((row + 0.5) / rows * source.height));
          const index = (sy * source.width + sx) * 4;
          const alpha = data.data[index + 3] / 255;
          if (!alpha) continue;
          ctx.fillStyle = "rgba(" + data.data[index] + "," + data.data[index + 1] + "," + data.data[index + 2] + "," + alpha + ")";
          ctx.beginPath();
          ctx.arc((col + 0.5) * cellW, (row + 0.5) * cellH, Math.min(cellW, cellH) * 0.43, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      fallbackCanvas.style.display = "block";
      canvas.style.display = "none";
      image.style.opacity = "0";
    } catch (fallbackError) {
      console.error("Dot fallback failed:", fallbackError);
      image.style.opacity = "1";
      canvas.style.display = "none";
    }
  }

  function shader(gl, type, source) {
    const item = gl.createShader(type);
    gl.shaderSource(item, source);
    gl.compileShader(item);
    if (!gl.getShaderParameter(item, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(item);
      gl.deleteShader(item);
      throw new Error(error || "Shader compile error");
    }
    return item;
  }

  async function start() {
    try {
      if (!image.complete || !image.naturalWidth) {
        await new Promise((resolve, reject) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", reject, { once: true });
        });
      }

      const gl = canvas.getContext("webgl", { alpha: true, antialias: true });
      if (!gl) throw new Error("WebGL context unavailable");

      const vertex = [
        "attribute vec2 a_position;",
        "void main(){ gl_Position = vec4(a_position, 0.0, 1.0); }"
      ].join("\n");
      const fragment = [
        "precision mediump float;",
        "uniform sampler2D u_image;",
        "uniform vec2 u_resolution;",
        "uniform vec2 u_grid;",
        "void main(){",
        " vec2 cellSize = u_resolution / u_grid;",
        " vec2 cell = floor(gl_FragCoord.xy / cellSize);",
        " vec2 uv = (cell + 0.5) / u_grid;",
        " vec4 color = texture2D(u_image, vec2(uv.x, 1.0 - uv.y));",
        " vec2 local = (fract(gl_FragCoord.xy / cellSize) - 0.5) * cellSize;",
        " float radius = min(cellSize.x, cellSize.y) * 0.43;",
        " float mask = 1.0 - smoothstep(radius - 0.7, radius + 0.7, length(local));",
        " gl_FragColor = vec4(color.rgb, color.a * mask);",
        "}"
      ].join("\n");

      const program = gl.createProgram();
      gl.attachShader(program, shader(gl, gl.VERTEX_SHADER, vertex));
      gl.attachShader(program, shader(gl, gl.FRAGMENT_SHADER, fragment));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || "Program link error");
      }
      gl.useProgram(program);

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1
      ]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(program, "a_position");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      const texture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.uniform1i(gl.getUniformLocation(program, "u_image"), 0);

      const resolutionLoc = gl.getUniformLocation(program, "u_resolution");
      const gridLoc = gl.getUniformLocation(program, "u_grid");
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      function render() {
        const rect = image.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.round(rect.width * dpr));
        canvas.height = Math.max(1, Math.round(rect.height * dpr));
        const { columns, rows } = getGrid(canvas.width, canvas.height);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2f(resolutionLoc, canvas.width, canvas.height);
        gl.uniform2f(gridLoc, columns, rows);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        const err = gl.getError();
        if (err !== gl.NO_ERROR) throw new Error("WebGL draw error: " + err);
        canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:2;display:block;pointer-events:none";
        image.style.opacity = "0";
      }

      render();
      if ("ResizeObserver" in window) {
        new ResizeObserver(() => {
          try { render(); } catch (error) { drawFallback(error); }
        }).observe(image);
      } else {
        window.addEventListener("resize", () => {
          try { render(); } catch (error) { drawFallback(error); }
        });
      }
    } catch (error) {
      drawFallback(error);
    }
  }

  image.style.opacity = "1";
  if (image.complete && image.naturalWidth) {
    requestAnimationFrame(() => start());
  } else {
    image.addEventListener("load", () => start(), { once: true });
    image.addEventListener("error", () => showOriginal(), { once: true });
  }
})();