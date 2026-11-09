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

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
        f.y
      );
    }

    float puff(vec2 p, vec2 center, vec2 radius, float strength) {
      vec2 d = (p - center) / radius;
      return exp(-dot(d, d) * 2.6) * strength;
    }

    void main() {
      float aspect = u_resolution.x / u_resolution.y;
      vec2 p = vec2((v_uv.x - 0.5) * aspect, v_uv.y);
      float cloudWidth = min(aspect * 0.43, 0.54);
      vec2 q = vec2(p.x / cloudWidth, (p.y - 0.77) / 0.205);
      q.x += sin(u_time * 0.10) * 0.018;

      float density = 0.0;
      density += puff(q, vec2(-0.72, -0.10), vec2(0.25, 0.37), 0.95);
      density += puff(q, vec2(-0.55,  0.19), vec2(0.24, 0.34), 0.95);
      density += puff(q, vec2(-0.34, -0.02), vec2(0.27, 0.39), 1.05);
      density += puff(q, vec2(-0.10,  0.15), vec2(0.25, 0.36), 0.95);
      density += puff(q, vec2( 0.12,  0.31), vec2(0.24, 0.34), 1.00);
      density += puff(q, vec2( 0.35,  0.10), vec2(0.28, 0.38), 1.05);
      density += puff(q, vec2( 0.60, -0.09), vec2(0.25, 0.34), 0.95);
      density += puff(q, vec2( 0.79,  0.10), vec2(0.21, 0.31), 0.85);

      density += puff(q, vec2(-0.43, -0.48), vec2(0.30, 0.28), 0.68);
      density += puff(q, vec2(-0.08, -0.43), vec2(0.34, 0.27), 0.72);
      density += puff(q, vec2( 0.29, -0.48), vec2(0.30, 0.28), 0.68);
      density += puff(q, vec2( 0.60, -0.40), vec2(0.23, 0.25), 0.50);

      float n = noise(q * 8.0 + vec2(u_time * 0.025, -u_time * 0.012));
      float fineNoise = noise(q * 19.0 - u_time * 0.018);
      float wisps = (n - 0.5) * 0.22 + (fineNoise - 0.5) * 0.10;
      float edge = smoothstep(0.72, 1.05, density + wisps);

      float innerLight = smoothstep(0.85, 2.6, density);
      vec3 cloudColor = mix(vec3(0.66, 0.68, 0.74), vec3(0.88, 0.89, 0.93), innerLight);
      float alpha = edge * 0.42 * smoothstep(-0.78, -0.55, q.y + 0.08);
      alpha *= 0.92 + n * 0.08;

      gl_FragColor = vec4(cloudColor, alpha);
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
