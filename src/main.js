import './style.css';
import { frames } from './animation.js';
import { generateLiquidGlassFilter } from './liquidGlass.js';
import { fireShader } from './fireShader.js';

const fps = 30;
const stage = document.getElementById("stage");
const asciiArt = document.getElementById("ascii-art");
let currentFrame = 0;
const ROWS_DOWN = 1;
const FILL = 0.5;
let hueOffset = 0;
let currentStyle = 'classic';
let liquidGlassBlob = null;
let svgDefs = null;
let mouseX = 0;
let mouseY = 0;

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
      const lineCount = lines.length;
      const time = Date.now() / 1000;

      asciiArt.innerHTML = lines.map((line, i) => {
        const uv = { x: 0.5, y: i / lineCount };
        const color = fireShader(uv, time);
        return `<span style="color: rgb(${color.r}, ${color.g}, ${color.b})">${line}</span>`;
      }).join('\n');
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
  asciiArt.style.fontFamily = styles[currentStyle].font;
  styles[currentStyle].apply();

  if (currentStyle === 'liquid-glass') {
    if (!liquidGlassBlob) {
      // Create SVG defs container
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
  } else {
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
  updateLiquidBlob();
});

if (frames && frames.length > 0) {
  createStylePicker();
  displayFrame(0);
  setInterval(() => {
    currentFrame = (currentFrame + 1) % frames.length;
    displayFrame(currentFrame);
  }, 1000 / fps);
}
