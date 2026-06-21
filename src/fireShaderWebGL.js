// WebGL-accelerated fire shader
// Renders fire effect to texture, then samples per-character

import { fireNoiseValues, fireNoiseSize } from './fireNoiseData.js';

export class FireShaderWebGL {
  constructor() {
    this.canvas = null;
    this.gl = null;
    this.program = null;
    this.textureWidth = 256;
    this.textureHeight = 256;
    this.noiseTexture = null;
    this.framebuffer = null;
    this.outputTexture = null;
  }

  init() {
    // Create offscreen canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.textureWidth;
    this.canvas.height = this.textureHeight;

    const gl = this.canvas.getContext('webgl', {
      premultipliedAlpha: false,
      preserveDrawingBuffer: true
    });

    if (!gl) return false;
    this.gl = gl;

    // Upload noise texture
    if (!this.createNoiseTexture()) return false;

    // Compile shaders
    if (!this.compileShaders()) return false;

    // Create framebuffer for rendering
    this.createFramebuffer();

    // Setup geometry (fullscreen quad)
    this.setupQuad();

    return true;
  }

  createNoiseTexture() {
    const gl = this.gl;

    this.noiseTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.noiseTexture);

    // Convert to Uint8Array
    const data = new Uint8Array(fireNoiseValues);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, fireNoiseSize.x, fireNoiseSize.y, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    return true;
  }

  compileShaders() {
    const gl = this.gl;

    const vertexShaderSource = `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_uv = a_position * 0.5 + 0.5;
      }
    `;

    const fragmentShaderSource = `
      precision mediump float;
      uniform sampler2D u_noise;
      uniform float u_time;
      uniform float u_scrollSpeed;
      uniform float u_contrastAmount;
      uniform float u_brightnessIntensity;
      uniform vec2 u_brightnessGradient;
      uniform vec2 u_fadeGradient;
      uniform float u_fadeIntensity;
      uniform vec2 u_firePos;
      uniform float u_fireRadius;
      uniform float u_fireFeather;
      uniform vec3 u_fireColorStart;
      uniform vec3 u_fireColorEnd;
      uniform float u_fireSaturation;
      varying vec2 v_uv;

      float blendOverlay(float a, float b) {
        return a < 0.5 ? (2.0 * a * b) : (1.0 - 2.0 * (1.0 - a) * (1.0 - b));
      }

      void main() {
        vec2 uv = v_uv;
        float scroll = floor(u_time * u_scrollSpeed);
        vec2 scrolledUV = vec2(uv.x, uv.y + scroll / 62.0);
        float noise = texture2D(u_noise, scrolledUV).r;
        noise = mix(noise, blendOverlay(noise, noise), u_contrastAmount);
        float brightness = max(min((uv.y - u_brightnessGradient.x) * (1.0 / ((1.0 - u_brightnessGradient.x) - (1.0 - u_brightnessGradient.y))), 1.0), 0.0);
        vec2 worldCoord = vec2((uv.x * 20.0) - 10.0, -((uv.y * 12.4) - 6.2));
        float dist = distance(worldCoord, u_firePos);
        float circleMask = smoothstep(u_fireRadius, u_fireRadius + u_fireFeather, dist);
        float barDist = abs(worldCoord.x - u_firePos.x);
        float barMask = smoothstep(u_fireRadius, u_fireRadius + u_fireFeather, barDist);
        float mask = 1.0 - (worldCoord.y >= u_firePos.y ? barMask : circleMask);
        float fade = max(min((uv.y - u_fadeGradient.x) * (1.0 / ((1.0 - u_fadeGradient.x) - (1.0 - u_fadeGradient.y))), 1.0), 0.0);
        float fireValue = (noise + brightness * u_brightnessIntensity) * mask - fade * u_fadeIntensity - (1.0 - mask);
        vec3 color = mix(u_fireColorStart / 255.0, u_fireColorEnd / 255.0, fireValue);
        color = mix(color, color + color, u_fireSaturation);
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vertexShader || !fragmentShader) return false;

    this.program = gl.createProgram();
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error('Shader link failed:', gl.getProgramInfoLog(this.program));
      return false;
    }

    return true;
  }

  createShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile failed:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  setupQuad() {
    const gl = this.gl;
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
  }

  createFramebuffer() {
    const gl = this.gl;
    this.framebuffer = gl.createFramebuffer();
    this.outputTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.outputTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.textureWidth, this.textureHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  render(time) {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.noiseTexture);
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_noise'), 0);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_time'), time);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_scrollSpeed'), 50.0);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_contrastAmount'), 0.742);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_brightnessIntensity'), 0.807);
    gl.uniform2f(gl.getUniformLocation(this.program, 'u_brightnessGradient'), 0.0, 0.562);
    gl.uniform2f(gl.getUniformLocation(this.program, 'u_fadeGradient'), 1.0, 0.3);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_fadeIntensity'), 1.0);
    gl.uniform2f(gl.getUniformLocation(this.program, 'u_firePos'), 0.0, -2.0);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_fireRadius'), 1.2);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_fireFeather'), 3.0);
    gl.uniform3f(gl.getUniformLocation(this.program, 'u_fireColorStart'), 60.0, 0.0, 0.0);
    gl.uniform3f(gl.getUniformLocation(this.program, 'u_fireColorEnd'), 255.0, 200.0, 50.0);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_fireSaturation'), 0.648);
    gl.viewport(0, 0, this.textureWidth, this.textureHeight);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  getColorAt(x, y) {
    const gl = this.gl;
    const px = Math.floor(x * this.textureWidth);
    const py = Math.floor(y * this.textureHeight);
    const pixels = new Uint8Array(4);
    gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return { r: pixels[0], g: pixels[1], b: pixels[2] };
  }

  // Batch read all pixels at once (much faster)
  getAllPixels() {
    const gl = this.gl;
    if (!this.pixelCache) {
      this.pixelCache = new Uint8Array(this.textureWidth * this.textureHeight * 4);
    }
    gl.readPixels(0, 0, this.textureWidth, this.textureHeight, gl.RGBA, gl.UNSIGNED_BYTE, this.pixelCache);
    return this.pixelCache;
  }

  getColorAtFromCache(x, y, pixelCache) {
    const px = Math.floor(x * this.textureWidth);
    const py = Math.floor(y * this.textureHeight);
    const idx = (py * this.textureWidth + px) * 4;
    return {
      r: pixelCache[idx],
      g: pixelCache[idx + 1],
      b: pixelCache[idx + 2]
    };
  }

  destroy() {
    if (this.gl) {
      this.gl.deleteTexture(this.noiseTexture);
      this.gl.deleteTexture(this.outputTexture);
      this.gl.deleteFramebuffer(this.framebuffer);
      this.gl.deleteProgram(this.program);
    }
    this.canvas = null;
    this.gl = null;
  }
}
