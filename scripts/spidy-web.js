const image = document.querySelector(".spidy-image");
const layer = document.querySelector(".spidy-image-layer");

if (image && layer) {
  const canvas = document.createElement("canvas");
  canvas.className = "spidy-pixel-canvas";
  canvas.setAttribute("aria-hidden", "true");
  layer.appendChild(canvas);

  image.style.opacity = "0";

  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: false
  });

  if (gl) {
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
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vertexShader = compile(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compile(gl.FRAGMENT_SHADER, fragmentSource);

    if (vertexShader && fragmentShader) {
      const program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);

      if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.useProgram(program);

        const width = image.naturalWidth;
        const height = image.naturalHeight;
        const offscreen = document.createElement("canvas");
        offscreen.width = width;
        offscreen.height = height;
        const context = offscreen.getContext("2d", { willReadFrequently: true });
        context.drawImage(image, 0, 0, width, height);

        const pixels = context.getImageData(0, 0, width, height).data;
        const positions = new Float32Array(width * height * 2);
        const colors = new Uint8Array(width * height * 4);

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const pixel = y * width + x;
            const source = pixel * 4;
            const target = pixel * 2;
            positions[target] = x + 0.5;
            positions[target + 1] = y + 0.5;
            colors[source] = pixels[source];
            colors[source + 1] = pixels[source + 1];
            colors[source + 2] = pixels[source + 2];
            colors[source + 3] = pixels[source + 3];
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
        gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
        const colorLocation = gl.getAttribLocation(program, "a_color");
        gl.enableVertexAttribArray(colorLocation);
        gl.vertexAttribPointer(colorLocation, 4, gl.UNSIGNED_BYTE, true, 0, 0);

        const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
        const pointSizeLocation = gl.getUniformLocation(program, "u_pointSize");
        gl.uniform2f(resolutionLocation, width, height);
        gl.uniform1f(pointSizeLocation, 1.6);

        function render() {
          const rect = layer.getBoundingClientRect();
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          canvas.width = Math.max(1, Math.round(rect.width * dpr));
          canvas.height = Math.max(1, Math.round(rect.height * dpr));
          gl.viewport(0, 0, canvas.width, canvas.height);
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.uniform1f(pointSizeLocation, Math.max(1, dpr * 1.15));
          gl.drawArrays(gl.POINTS, 0, width * height);
        }

        render();
        if ("ResizeObserver" in window) {
          new ResizeObserver(render).observe(layer);
        } else {
          window.addEventListener("resize", render);
        }
      }
    }
  } else {
    image.style.opacity = "1";
    canvas.remove();
  }
}
