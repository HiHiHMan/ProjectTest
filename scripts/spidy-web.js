(() => {
  const image = document.querySelector(".spidy-image");
  const layer = document.querySelector(".spidy-image-layer");
  const canvas = layer?.querySelector(".spidy-pixel-canvas");
  if (!image || !layer || !canvas) return;

  // Keep the original image visible until WebGL has drawn successfully.
  const showOriginal = () => {
    image.style.opacity = "1";
    canvas.style.display = "none";
  };

  async function start() {
    try {
      if (!image.complete || !image.naturalWidth) {
        await new Promise((resolve, reject) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", reject, { once: true });
        });
      }

      const width = image.naturalWidth;
      const height = image.naturalHeight;
      if (!width || !height) throw new Error("Image failed to load");

      const sourceCanvas = document.createElement("canvas");
      sourceCanvas.width = width;
      sourceCanvas.height = height;
      const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
      sourceContext.drawImage(image, 0, 0, width, height);
      const pixels = sourceContext.getImageData(0, 0, width, height).data;

      const gl = canvas.getContext("webgl", {
        alpha: true,
        antialias: false,
        premultipliedAlpha: false
      });
      if (!gl) throw new Error("WebGL is unavailable");

      const vertexSource = `
        attribute vec2 a_position;
        attribute vec4 a_color;
        uniform vec2 u_resolution;
        uniform float u_pointSize;
        varying vec4 v_color;
        void main() {
          vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
          gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
          gl_PointSize = u_pointSize;
          v_color = a_color;
        }
      `;
      const fragmentSource = `
        precision mediump float;
        varying vec4 v_color;
        void main() {
          vec2 p = gl_PointCoord - vec2(0.5);
          if (dot(p, p) > 0.25) discard;
          gl_FragColor = v_color;
        }
      `;

      function compile(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          throw new Error(gl.getShaderInfoLog(shader) || "Shader compile failed");
        }
        return shader;
      }

      const program = gl.createProgram();
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || "WebGL link failed");
      }
      gl.useProgram(program);

      const positions = new Float32Array(width * height * 2);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 2;
          positions[i] = x + 0.5;
          positions[i + 1] = y + 0.5;
        }
      }

      const positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
      const positionLocation = gl.getAttribLocation(program, "a_position");
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      const colorBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, pixels, gl.STATIC_DRAW);
      const colorLocation = gl.getAttribLocation(program, "a_color");
      gl.enableVertexAttribArray(colorLocation);
      gl.vertexAttribPointer(colorLocation, 4, gl.UNSIGNED_BYTE, true, 0, 0);

      const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
      const pointSizeLocation = gl.getUniformLocation(program, "u_pointSize");
      gl.uniform2f(resolutionLocation, width, height);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      function render() {
        const rect = image.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.round(rect.width * dpr));
        canvas.height = Math.max(1, Math.round(rect.height * dpr));
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(pointSizeLocation, Math.max(1, canvas.width / width));
        gl.drawArrays(gl.POINTS, 0, width * height);

        if (gl.getError() !== gl.NO_ERROR) throw new Error("WebGL draw failed");
        image.style.opacity = "0";
        canvas.style.display = "block";
      }

      render();
      if ("ResizeObserver" in window) {
        new ResizeObserver(render).observe(image);
      } else {
        window.addEventListener("resize", render);
      }
    } catch (error) {
      console.error("Spidy pixel rendering failed:", error);
      showOriginal();
    }
  }

  image.style.opacity = "1";
  start();
})();
