(() => {
  const image = document.querySelector(".spidy-image");
  const layer = document.querySelector(".spidy-image-layer");
  const canvas = layer?.querySelector(".spidy-pixel-canvas");
  if (!image || !layer || !canvas) return;

  const showOriginal = (error) => {
    if (error) console.error("Spidy WebGL failed:", error);
    image.style.opacity = "1";
    canvas.style.display = "none";
  };

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(message || "Shader compile failed");
    }
    return shader;
  }

  async function start() {
    try {
      if (!image.complete || !image.naturalWidth) {
        await new Promise((resolve, reject) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", reject, { once: true });
        });
      }

      const gl = canvas.getContext("webgl", {
        alpha: true, antialias: false, premultipliedAlpha: false
      });
      if (!gl) throw new Error("WebGL is unavailable");

      const vertexSource = [
        "attribute vec2 a_position;",
        "varying vec2 v_uv;",
        "void main() {",
        "  gl_Position = vec4(a_position, 0.0, 1.0);",
        "  v_uv = a_position * 0.5 + 0.5;",
        "}"
      ].join("\n");

      const fragmentSource = [
        "precision mediump float;",
        "uniform sampler2D u_image;",
        "uniform vec2 u_resolution;",
        "uniform float u_dotSize;",
        "varying vec2 v_uv;",
        "void main() {",
        "  vec2 cell = floor(gl_FragCoord.xy / u_dotSize);",
        "  vec2 samplePixel = (cell + 0.5) * u_dotSize;",
        "  vec2 uv = clamp(samplePixel / u_resolution, 0.001, 0.999);",
        "  vec4 color = texture2D(u_image, vec2(uv.x, 1.0 - uv.y));",
        "  vec2 local = fract(gl_FragCoord.xy / u_dotSize) - 0.5;",
        "  float circle = 1.0 - smoothstep(0.34, 0.48, length(local));",
        "  gl_FragColor = vec4(color.rgb, color.a * circle);",
        "}"
      ].join("\n");

      const program = gl.createProgram();
      gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vertexSource));
      gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fragmentSource));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || "Program link failed");
      }
      gl.useProgram(program);

      const vertices = new Float32Array([
        -1, -1, 1, -1, -1, 1,
        -1, 1, 1, -1, 1, 1
      ]);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, "a_position");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      const texture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.uniform1i(gl.getUniformLocation(program, "u_image"), 0);

      const resolution = gl.getUniformLocation(program, "u_resolution");
      const dotSize = gl.getUniformLocation(program, "u_dotSize");
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      function render() {
        const rect = image.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.round(rect.width * dpr));
        canvas.height = Math.max(1, Math.round(rect.height * dpr));
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2f(resolution, canvas.width, canvas.height);
        gl.uniform1f(dotSize, 3.2 * dpr);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        const error = gl.getError();
        if (error !== gl.NO_ERROR) throw new Error("WebGL render error: " + error);
        canvas.style.display = "block";
        image.style.opacity = "0";
      }

      render();
      if ("ResizeObserver" in window) {
        new ResizeObserver(() => {
          try { render(); } catch (error) { showOriginal(error); }
        }).observe(image);
      } else {
        window.addEventListener("resize", () => {
          try { render(); } catch (error) { showOriginal(error); }
        });
      }
    } catch (error) {
      showOriginal(error);
    }
  }

  image.style.opacity = "1";
  start();
})();