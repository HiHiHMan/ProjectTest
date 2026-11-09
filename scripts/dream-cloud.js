(() => {
  const canvas = document.querySelector('.dream-cloud-canvas');
  if (!canvas) return;

  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: true,
    premultipliedAlpha: false
  });
  if (!gl) {
    console.warn('WebGL is not available; cloud rendering is disabled.');
    return;
  }

  const vertexSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentSource = `
    precision highp float;
    varying vec2 v_uv;
    uniform vec2 u_resolution;
    uniform float u_time;

    float circleSdf(vec2 p, vec2 center, float radius) {
      return length(p - center) - radius;
    }
    float smoothUnion(float a, float b, float k) {
      float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
      return mix(b, a, h) - k * h * (1.0 - h);
    }

    void main() {
      float aspect = u_resolution.x / u_resolution.y;
      vec2 p = vec2((v_uv.x - 0.5) * aspect, v_uv.y);
      vec2 q = vec2(p.x / min(aspect * 0.43, 0.54), (p.y - 0.77) / 0.205);
      q.x += sin(u_time * 0.22) * 0.012;

      // Distinct round jelly-like bubbles softly joined into a cloud.
      float d = 10.0;
      d = smoothUnion(d, circleSdf(q, vec2(-0.76, -0.02), 0.25), 0.13);
      d = smoothUnion(d, circleSdf(q, vec2(-0.58,  0.27), 0.23), 0.13);
      d = smoothUnion(d, circleSdf(q, vec2(-0.38, -0.02), 0.29), 0.14);
      d = smoothUnion(d, circleSdf(q, vec2(-0.18,  0.27), 0.24), 0.13);
      d = smoothUnion(d, circleSdf(q, vec2( 0.06,  0.43), 0.25), 0.13);
      d = smoothUnion(d, circleSdf(q, vec2( 0.29,  0.19), 0.29), 0.14);
      d = smoothUnion(d, circleSdf(q, vec2( 0.55, -0.02), 0.25), 0.13);
      d = smoothUnion(d, circleSdf(q, vec2( 0.76,  0.20), 0.21), 0.12);
      d = smoothUnion(d, circleSdf(q, vec2(-0.43, -0.40), 0.23), 0.12);
      d = smoothUnion(d, circleSdf(q, vec2(-0.08, -0.39), 0.27), 0.13);
      d = smoothUnion(d, circleSdf(q, vec2( 0.27, -0.39), 0.24), 0.12);
      d = smoothUnion(d, circleSdf(q, vec2( 0.57, -0.35), 0.20), 0.11);

      float aa = max(fwidth(d), 0.002);
      float body = 1.0 - smoothstep(-aa, aa, d);
      if (body <= 0.001) discard;

      float rim = smoothstep(0.10, -0.015, d);
      float light = 0.0;
      light += exp(-length((q - vec2(-0.63, 0.35)) * vec2(1.0, 1.15)) * 13.0);
      light += exp(-length((q - vec2(-0.18, 0.36)) * vec2(1.0, 1.15)) * 13.0);
      light += exp(-length((q - vec2(0.06, 0.53)) * vec2(1.0, 1.15)) * 13.0);
      light += exp(-length((q - vec2(0.37, 0.29)) * vec2(1.0, 1.15)) * 13.0);
      vec3 base = vec3(0.62, 0.65, 0.72);
      vec3 jelly = base + vec3(0.20, 0.20, 0.22) * rim
                         + vec3(0.16, 0.16, 0.17) * clamp(light, 0.0, 1.0);
      gl_FragColor = vec4(jelly, body * 0.48);
    }
  `;;

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
  if (!vertexShader || !fragmentShader) return;

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return;
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1, 1, -1, -1, 1,
    -1, 1, 1, -1, 1, 1
  ]), gl.STATIC_DRAW);

  gl.useProgram(program);
  const position = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
  const timeLocation = gl.getUniformLocation(program, 'u_time');
  const start = performance.now();

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.uniform2f(resolutionLocation, width, height);
  }

  function render(now) {
    resize();
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(timeLocation, (now - start) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
  window.addEventListener('resize', resize, { passive: true });
})();
