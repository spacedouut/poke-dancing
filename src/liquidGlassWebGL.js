import { GLASS_FRAG } from './shaders/glass.frag.js';
import { BLUR_FRAG } from './shaders/blur.frag.js';
import { FULLSCREEN_QUAD_VERT } from './shaders/fullscreen-quad.vert.js';

/**
 * WebGL-based liquid glass blob that follows the mouse and stretches
 */
export class LiquidGlassBlob {
  constructor() {
    this.canvas = null;
    this.gl = null;
    this.sceneCanvas = null;
    this.sceneCtx = null;
    this.programs = {};
    this.framebuffers = {};
    this.textures = {};

    this.mouseX = 0.5;
    this.mouseY = 0.5;
    this.targetX = 0.5;
    this.targetY = 0.5;
    this.velocityX = 0;
    this.velocityY = 0;

    // Blob physics
    this.blobRadius = 100;
    this.targetRadius = 100;
    this.radiusVelocity = 0;

    this.lastTime = performance.now();
  }

  init() {
    // Create scene canvas (what we're distorting through the glass)
    this.sceneCanvas = document.createElement('canvas');
    this.sceneCtx = this.sceneCanvas.getContext('2d');

    // Create WebGL canvas (the glass effect)
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'liquid-glass-canvas';
    this.canvas.style.position = 'fixed';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '1000';
    this.canvas.style.left = '0';
    this.canvas.style.top = '0';
    document.body.appendChild(this.canvas);

    this.gl = this.canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false
    });

    if (!this.gl) {
      console.error('WebGL not supported');
      return false;
    }

    this.resize();
    this.createPrograms();
    this.createGeometry();
    this.createFramebuffers();

    window.addEventListener('resize', () => this.resize());

    return true;
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';

    this.sceneCanvas.width = w * dpr;
    this.sceneCanvas.height = h * dpr;

    if (this.gl) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      this.createFramebuffers();
    }
  }

  createPrograms() {
    const gl = this.gl;

    // Compile shader helper
    const compileShader = (source, type) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    // Link program helper
    const linkProgram = (vertSrc, fragSrc) => {
      const vert = compileShader(vertSrc, gl.VERTEX_SHADER);
      const frag = compileShader(fragSrc, gl.FRAGMENT_SHADER);

      if (!vert || !frag) return null;

      const program = gl.createProgram();
      gl.attachShader(program, vert);
      gl.attachShader(program, frag);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        return null;
      }

      return program;
    };

    // Create glass program
    this.programs.glass = linkProgram(FULLSCREEN_QUAD_VERT, GLASS_FRAG);

    // Create blur program
    this.programs.blur = linkProgram(FULLSCREEN_QUAD_VERT, BLUR_FRAG);
  }

  createGeometry() {
    const gl = this.gl;

    // Fullscreen quad
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]);

    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  }

  createFramebuffers() {
    const gl = this.gl;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const blurW = Math.floor(w / 4);
    const blurH = Math.floor(h / 4);

    // Clean up old framebuffers
    Object.values(this.framebuffers).forEach(fb => {
      if (fb.framebuffer) gl.deleteFramebuffer(fb.framebuffer);
      if (fb.texture) gl.deleteTexture(fb.texture);
    });

    // Create blur framebuffer (quarter res)
    const createFBO = (width, height) => {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      const framebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

      return { framebuffer, texture, width, height };
    };

    this.framebuffers.blurTemp = createFBO(blurW, blurH);
    this.framebuffers.blurred = createFBO(blurW, blurH);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  updatePhysics(dt) {
    // Direct cursor following - no spring physics
    const prevX = this.mouseX;
    const prevY = this.mouseY;

    this.mouseX = this.targetX;
    this.mouseY = this.targetY;

    // Calculate velocity for stretch effect
    const dx = this.mouseX - prevX;
    const dy = this.mouseY - prevY;
    this.velocityX = dx / Math.max(dt, 0.001);
    this.velocityY = dy / Math.max(dt, 0.001);

    // Blob radius stretch based on velocity
    const speed = Math.sqrt(this.velocityX * this.velocityX + this.velocityY * this.velocityY);
    this.targetRadius = 100 + speed * 50;

    const dr = this.targetRadius - this.blobRadius;
    this.radiusVelocity += dr * 10 * dt;
    this.radiusVelocity *= Math.pow(0.8, dt);

    this.blobRadius += this.radiusVelocity * dt;
  }

  captureScene() {
    // Capture the current page as the scene texture
    const ctx = this.sceneCtx;
    const w = this.sceneCanvas.width;
    const h = this.sceneCanvas.height;

    // Fill with page screenshot (simplified - just grab the ASCII art area)
    const asciiArt = document.getElementById('ascii-art');
    if (asciiArt) {
      // Get computed styles
      const styles = window.getComputedStyle(asciiArt);
      const color = styles.color;
      const bgColor = styles.backgroundColor || '#000';

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = color;
      ctx.font = styles.font;
      ctx.textBaseline = 'top';

      const lines = asciiArt.textContent.split('\n');
      const lineHeight = parseInt(styles.lineHeight) || 20;
      const scale = window.devicePixelRatio || 1;

      lines.forEach((line, i) => {
        ctx.fillText(line, 10 * scale, i * lineHeight * scale);
      });
    }

    // Upload to WebGL texture
    const gl = this.gl;
    if (!this.textures.scene) {
      this.textures.scene = gl.createTexture();
    }

    gl.bindTexture(gl.TEXTURE_2D, this.textures.scene);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.sceneCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  blur(inputTexture, outputFBO, direction) {
    const gl = this.gl;
    const prog = this.programs.blur;

    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFBO.framebuffer);
    gl.viewport(0, 0, outputFBO.width, outputFBO.height);

    gl.useProgram(prog);

    const posLoc = gl.getAttribLocation(prog, 'a_position');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, inputTexture);
    gl.uniform1i(gl.getUniformLocation(prog, 'u_scene'), 0);
    gl.uniform2f(gl.getUniformLocation(prog, 'u_resolution'), outputFBO.width, outputFBO.height);
    gl.uniform2f(gl.getUniformLocation(prog, 'u_direction'), direction[0], direction[1]);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_radius'), 32.0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  render() {
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    this.updatePhysics(dt);
    this.captureScene();

    const gl = this.gl;

    // Blur pass
    this.blur(this.textures.scene, this.framebuffers.blurTemp, [1, 0]);
    this.blur(this.framebuffers.blurTemp.texture, this.framebuffers.blurred, [0, 1]);

    // Glass pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const prog = this.programs.glass;
    gl.useProgram(prog);

    const posLoc = gl.getAttribLocation(prog, 'a_position');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // Calculate blob card rect in normalized viewport coordinates
    const blobSize = this.blobRadius * 2;
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    const blobX = this.mouseX * vpW - this.blobRadius;
    const blobY = this.mouseY * vpH - this.blobRadius;

    const cardRect = [
      blobX / vpW,
      blobY / vpH,
      blobSize / vpW,
      blobSize / vpH
    ];

    // Light direction (from blob center to mouse)
    const lightDir = [0, 0];
    const speed = Math.sqrt(this.velocityX * this.velocityX + this.velocityY * this.velocityY);
    if (speed > 0.001) {
      lightDir[0] = this.velocityX / speed;
      lightDir[1] = this.velocityY / speed;
    }

    // Bind textures
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.scene);
    gl.uniform1i(gl.getUniformLocation(prog, 'u_scene'), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.framebuffers.blurred.texture);
    gl.uniform1i(gl.getUniformLocation(prog, 'u_blurredScene'), 1);

    // Set uniforms
    gl.uniform2f(gl.getUniformLocation(prog, 'u_resolution'), blobSize, blobSize);
    gl.uniform2f(gl.getUniformLocation(prog, 'u_sceneResolution'), this.canvas.width, this.canvas.height);
    gl.uniform4fv(gl.getUniformLocation(prog, 'u_cardRect'), cardRect);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_glass'), 1.0);

    gl.uniform1f(gl.getUniformLocation(prog, 'u_cornerRadius'), this.blobRadius);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_ior'), 1.4);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_glassThickness'), 80.0);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_normalStrength'), 2.0);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_displacementScale'), 1.0);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_transitionWidth'), 20.0);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_sminK'), 8.0);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_highlightWidth'), 15.0);
    gl.uniform4f(gl.getUniformLocation(prog, 'u_overlayColor'), 0.8, 0.9, 1.0, 0.3);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_frostHeight'), 0.0);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_frostNoiseScale'), 8.0);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_frostNoiseFreq'), 4.0);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_frostChannelSpread'), 2.0);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_frostDarken'), 0.3);
    gl.uniform3f(gl.getUniformLocation(prog, 'u_frostOverlayBg'), 0.95, 0.95, 0.95);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_frostEnabled'), 0.0);

    gl.uniform2fv(gl.getUniformLocation(prog, 'u_lightDir'), lightDir);
    gl.uniform2f(gl.getUniformLocation(prog, 'u_lightPos'), 0.5, 0.5);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_specularIntensity'), 0.6);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_specularSize'), 32.0);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_dropShadowAlpha'), 0.3);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_dropShadowBlur'), 20.0);
    gl.uniform2f(gl.getUniformLocation(prog, 'u_dropShadowOffset'), 0.0, 5.0);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_edgeBloom'), 0.2);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_edgeBloomRadius'), 30.0);
    gl.uniform2f(gl.getUniformLocation(prog, 'u_blurResolution'),
      this.framebuffers.blurred.width, this.framebuffers.blurred.height);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_edgeGamma'), 1.8);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    requestAnimationFrame(() => this.render());
  }

  setMousePosition(x, y) {
    this.targetX = x / window.innerWidth;
    this.targetY = y / window.innerHeight;
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}
