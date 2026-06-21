import './style.css';
import { frames } from './animation.js';
import { generateLiquidGlassFilter } from './liquidGlass.js';
import { LiquidGlassBlob } from './liquidGlassWebGL.js';
import { fireShader } from './fireShader.js';
import { FireShaderWebGL } from './fireShaderWebGL.js';
import { FireShaderOptimized } from './fireShaderOptimized.js';

const fps = 30;
const stage = document.getElementById("stage");
const asciiArt = document.getElementById("ascii-art");
let currentFrame = 0;
const ROWS_DOWN = 1;
const FILL = 0.5;
let hueOffset = 0;
let currentStyle = 'classic';
let liquidGlassBlob = null;
let liquidGlassBlobWebGL = null;
let svgDefs = null;
let mouseX = 0;
let mouseY = 0;
let fireShaderWebGL = null;
let fireShaderOptimized = null;
let performanceMonitor = { frames: [], avgFps: 30, lastDropTime: 0 };

const styles = {
  'classic': {
    name: 'Classic',
    font: '"Courier New", monospace',
    apply: () => {
      asciiArt.innerHTML = asciiArt.textContent;
      asciiArt.style.color = '#fff';
    }
  },
  'retro-rainbow': {
    name: 'Retro Rainbow',
    font: '"Sixtyfour", "Courier New", monospace',
    apply: () => {
      const lines = asciiArt.textContent.split("\n");
      const lineCount = lines.length;
      asciiArt.innerHTML = lines.map((line, i) => {
        const hue = (hueOffset + (i / lineCount) * 360) % 360;
        return `<span style="color: hsl(${hue}, 70%, 80%)">${line}</span>`;
      }).join('\n');
      hueOffset += 2;
    }
  },
  'matrix': {
    name: 'Matrix',
    font: '"VT323", monospace',
    apply: () => {
      asciiArt.innerHTML = asciiArt.textContent;
      asciiArt.style.color = '#0f0';
    }
  },
  'amber': {
    name: 'Amber',
    font: '"Share Tech Mono", monospace',
    apply: () => {
      asciiArt.innerHTML = asciiArt.textContent;
      asciiArt.style.color = '#ffb000';
    }
  },
  'neon-pulse': {
    name: 'Neon Pulse',
    font: '"Sixtyfour", "Courier New", monospace',
    apply: () => {
      const pulse = Math.sin(hueOffset * 0.05) * 0.5 + 0.5;
      const hue = hueOffset % 2 < 1 ? 180 : 320;
      asciiArt.innerHTML = asciiArt.textContent;
      asciiArt.style.color = `hsl(${hue}, 100%, ${50 + pulse * 30}%)`;
      asciiArt.style.textShadow = `0 0 ${10 + pulse * 20}px currentColor`;
      hueOffset += 0.1;
    }
  },
  'fire': {
    name: 'Fire',
    font: '"Courier New", monospace',
    apply: () => {
      const lines = asciiArt.textContent.split("\n");
      const time = Date.now() / 1000;
      const startTime = performance.now();

      // Try WebGL first, fall back to optimized CPU
      if (fireShaderWebGL) {
        fireShaderWebGL.render(time);

        // Batch read all pixels once instead of per-character
        const pixelCache = fireShaderWebGL.getAllPixels();

        const lineCount = lines.length;
        const result = new Array(lineCount);

        for (let i = 0; i < lineCount; i++) {
          const line = lines[i];
          const lineLength = line.length || 1;
          const chars = new Array(lineLength);

          for (let charIndex = 0; charIndex < lineLength; charIndex++) {
            const char = line[charIndex];
            const u = charIndex / lineLength;
            const v = i / lineCount;
            const color = fireShaderWebGL.getColorAtFromCache(u, v, pixelCache);
            const glowColor = `rgb(${color.r},${color.g},${color.b})`;
            chars[charIndex] = `<span style="color:${glowColor};text-shadow:0 0 15px ${glowColor}">${char}</span>`;
          }

          result[i] = chars.join('');
        }

        asciiArt.innerHTML = result.join('\n');
      } else if (fireShaderOptimized) {
        asciiArt.innerHTML = fireShaderOptimized.applyToLines(lines, time);
      } else {
        // Fallback to original grid sampling
        const gridCols = 20;
        const gridRows = 20;
        const colorGrid = [];

        for (let gy = 0; gy < gridRows; gy++) {
          colorGrid[gy] = [];
          for (let gx = 0; gx < gridCols; gx++) {
            const uv = {
              x: gx / (gridCols - 1),
              y: gy / (gridRows - 1)
            };
            colorGrid[gy][gx] = fireShader(uv, time);
          }
        }

        const lineCount = lines.length;
        asciiArt.innerHTML = lines.map((line, i) => {
          const lineLength = line.length || 1;
          const gridY = Math.floor((i / lineCount) * (gridRows - 1));

          return Array.from(line).map((char, charIndex) => {
            const gridX = Math.floor((charIndex / lineLength) * (gridCols - 1));
            const color = colorGrid[gridY][gridX];
            const glowColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
            return `<span style="color: ${glowColor}; text-shadow: 0 0 15px ${glowColor}">${char}</span>`;
          }).join('');
        }).join('\n');
      }

      const renderTime = performance.now() - startTime;
      updatePerformanceMonitor(renderTime);
    }
  },
  'chromatic': {
    name: 'Chromatic',
    font: '"Courier New", monospace',
    apply: () => {
      asciiArt.innerHTML = asciiArt.textContent;
      asciiArt.style.color = '#fff';
      asciiArt.style.textShadow = '2px 0 0 #ff0000, -2px 0 0 #00ffff';
    }
  },
  'thermal': {
    name: 'Thermal',
    font: '"Share Tech Mono", monospace',
    apply: () => {
      const lines = asciiArt.textContent.split("\n");
      const lineCount = lines.length;
      asciiArt.innerHTML = lines.map((line, i) => {
        const t = i / lineCount;
        let hue, sat, light;
        if (t < 0.25) {
          hue = 240;
          sat = 100;
          light = 30 + t * 80;
        } else if (t < 0.5) {
          hue = 280;
          sat = 100;
          light = 50;
        } else if (t < 0.75) {
          hue = 0;
          sat = 100;
          light = 50;
        } else {
          hue = 40;
          sat = 100;
          light = 50 + (t - 0.75) * 100;
        }
        return `<span style="color: hsl(${hue}, ${sat}%, ${light}%)">${line}</span>`;
      }).join('\n');
    }
  },
  'liquid-glass': {
    name: 'Liquid Glass',
    font: '"Courier New", monospace',
    apply: () => {
      asciiArt.innerHTML = asciiArt.textContent;
      asciiArt.style.color = '#fff';
    }
  }
};

function updatePerformanceMonitor(renderTime) {
  const now = performance.now();
  performanceMonitor.frames.push({ time: now, renderTime });

  // Keep last 60 frames
  if (performanceMonitor.frames.length > 60) {
    performanceMonitor.frames.shift();
  }

  // Calculate average FPS
  if (performanceMonitor.frames.length >= 2) {
    const first = performanceMonitor.frames[0].time;
    const last = performanceMonitor.frames[performanceMonitor.frames.length - 1].time;
    const duration = (last - first) / 1000;
    performanceMonitor.avgFps = performanceMonitor.frames.length / duration;
  }

  // Adaptive quality: if FPS drops below 25, reduce quality
  if (performanceMonitor.avgFps < 25 && now - performanceMonitor.lastDropTime > 2000) {
    if (fireShaderOptimized) {
      console.log('FPS drop detected, reducing quality');
      fireShaderOptimized.setQuality('low');
      performanceMonitor.lastDropTime = now;
    }
  } else if (performanceMonitor.avgFps > 28 && fireShaderOptimized && now - performanceMonitor.lastDropTime > 5000) {
    fireShaderOptimized.setQuality('high');
  }
}

function initFireShader() {
  // Try WebGL first
  fireShaderWebGL = new FireShaderWebGL();
  if (fireShaderWebGL.init()) {
    console.log('Fire shader: WebGL mode (GPU accelerated)');
    return;
  }

  // Fallback to optimized CPU
  console.log('Fire shader: Optimized CPU mode');
  fireShaderWebGL = null;
  fireShaderOptimized = new FireShaderOptimized();
  fireShaderOptimized.setQuality('high');
}

function fit() {
  const w = asciiArt.offsetWidth;
  const h = asciiArt.offsetHeight;
  if (!w || !h) return;

  const fitH = stage.clientHeight / h;
  const fitW = stage.clientWidth / w;
  const scale = Math.min(fitH, fitW) + (fitH - Math.min(fitH, fitW)) * FILL;
  const lines = asciiArt.textContent.split("\n").length || 1;
  const rowHeight = h / lines;

  asciiArt.style.transform = `scale(${scale}) translateY(${rowHeight * ROWS_DOWN}px)`;
}

function applyCurrentStyle() {
  // Reset all custom properties before applying new style
  asciiArt.style.color = '';
  asciiArt.style.textShadow = '';

  asciiArt.style.fontFamily = styles[currentStyle].font;
  styles[currentStyle].apply();

  if (currentStyle === 'liquid-glass') {
    if (!liquidGlassBlobWebGL) {
      liquidGlassBlobWebGL = new LiquidGlassBlob();
      if (liquidGlassBlobWebGL.init()) {
        liquidGlassBlobWebGL.render();
      } else {
        // Fallback to SVG if WebGL not supported
        console.warn('WebGL not supported, falling back to SVG filter');
        if (!svgDefs) {
          const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          svg.setAttribute("width", "0");
          svg.setAttribute("height", "0");
          svg.style.position = "absolute";
          svg.style.overflow = "hidden";
          svgDefs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
          svg.appendChild(svgDefs);
          document.body.appendChild(svg);
        }

        liquidGlassBlob = document.createElement('div');
        liquidGlassBlob.id = 'liquid-blob';
        document.body.appendChild(liquidGlassBlob);
        updateLiquidGlassFilter();
      }
    }
  } else {
    if (liquidGlassBlobWebGL) {
      liquidGlassBlobWebGL.destroy();
      liquidGlassBlobWebGL = null;
    }
    if (liquidGlassBlob) {
      liquidGlassBlob.remove();
      liquidGlassBlob = null;
    }
    if (svgDefs) {
      svgDefs.parentElement.remove();
      svgDefs = null;
    }
  }
}

function updateLiquidGlassFilter() {
  if (!liquidGlassBlob || !svgDefs) return;

  const size = 200;
  const radius = 100;
  const glassThickness = 80;
  const bezelWidth = 20;
  const ior = 2.5;
  const scaleRatio = 1.0;

  const { dispUrl, scale } = generateLiquidGlassFilter(
    size, size, radius, glassThickness, bezelWidth, ior, scaleRatio
  );

  svgDefs.innerHTML = `
    <filter id="liquid-glass-filter" x="0%" y="0%" width="100%" height="100%">
      <feImage href="${dispUrl}" x="0" y="0" width="${size}" height="${size}" result="disp_map" />
      <feDisplacementMap in="SourceGraphic" in2="disp_map"
        scale="${scale}" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  `;

  liquidGlassBlob.style.backdropFilter = `url(#liquid-glass-filter)`;
}

function updateLiquidBlob() {
  if (liquidGlassBlob && currentStyle === 'liquid-glass') {
    liquidGlassBlob.style.left = mouseX + 'px';
    liquidGlassBlob.style.top = mouseY + 'px';
  }
}

function displayFrame(index) {
  asciiArt.textContent = frames[index];
  applyCurrentStyle();
  fit();
}

function createStylePicker() {
  const picker = document.createElement('div');
  picker.id = 'style-picker';
  picker.innerHTML = `
    <select id="style-select">
      ${Object.entries(styles).map(([key, style]) =>
        `<option value="${key}" ${key === currentStyle ? 'selected' : ''}>${style.name}</option>`
      ).join('')}
    </select>
  `;
  document.body.appendChild(picker);

  document.getElementById('style-select').addEventListener('change', (e) => {
    currentStyle = e.target.value;
    displayFrame(currentFrame);
  });
}

window.addEventListener("resize", fit);

window.addEventListener("mousemove", (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;

  if (liquidGlassBlobWebGL) {
    liquidGlassBlobWebGL.setMousePosition(mouseX, mouseY);
  } else {
    updateLiquidBlob();
  }
});

if (frames && frames.length > 0) {
  initFireShader();
  createStylePicker();
  displayFrame(0);
  setInterval(() => {
    currentFrame = (currentFrame + 1) % frames.length;
    displayFrame(currentFrame);
  }, 1000 / fps);
}
