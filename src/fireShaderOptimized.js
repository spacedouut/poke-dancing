// Optimized CPU-based fire shader with adaptive grid and caching

import { fireShader } from './fireShader.js';

export class FireShaderOptimized {
  constructor() {
    this.gridCols = 40; // Increased from 20 for more color zones
    this.gridRows = 40;
    this.colorGrid = [];
    this.lastTime = -1;
    this.frameCache = null;
    this.cacheValid = false;
  }

  setQuality(level) {
    // Adaptive quality: 'low' (20x20), 'medium' (40x40), 'high' (60x60)
    if (level === 'low') {
      this.gridCols = 20;
      this.gridRows = 20;
    } else if (level === 'medium') {
      this.gridCols = 40;
      this.gridRows = 40;
    } else if (level === 'high') {
      this.gridCols = 60;
      this.gridRows = 60;
    }
    this.cacheValid = false;
  }

  precomputeGrid(time) {
    // Only recompute if time changed significantly (>0.01s)
    if (Math.abs(time - this.lastTime) < 0.01 && this.cacheValid) {
      return;
    }

    this.lastTime = time;
    this.colorGrid = new Array(this.gridRows);

    // Pre-allocate all arrays for better memory performance
    for (let gy = 0; gy < this.gridRows; gy++) {
      this.colorGrid[gy] = new Array(this.gridCols);
    }

    // Compute grid values
    for (let gy = 0; gy < this.gridRows; gy++) {
      const v = gy / (this.gridRows - 1);
      for (let gx = 0; gx < this.gridCols; gx++) {
        const u = gx / (this.gridCols - 1);
        this.colorGrid[gy][gx] = fireShader({ x: u, y: v }, time);
      }
    }

    this.cacheValid = true;
  }

  getColorAtUV(u, v) {
    if (!this.cacheValid) return { r: 0, g: 0, b: 0 };

    // Bilinear interpolation for smoother color transitions
    const gx = u * (this.gridCols - 1);
    const gy = v * (this.gridRows - 1);

    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const x1 = Math.min(x0 + 1, this.gridCols - 1);
    const y1 = Math.min(y0 + 1, this.gridRows - 1);

    const fx = gx - x0;
    const fy = gy - y0;

    const c00 = this.colorGrid[y0][x0];
    const c10 = this.colorGrid[y0][x1];
    const c01 = this.colorGrid[y1][x0];
    const c11 = this.colorGrid[y1][x1];

    // Bilinear blend
    const r = (c00.r * (1 - fx) + c10.r * fx) * (1 - fy) + (c01.r * (1 - fx) + c11.r * fx) * fy;
    const g = (c00.g * (1 - fx) + c10.g * fx) * (1 - fy) + (c01.g * (1 - fx) + c11.g * fx) * fy;
    const b = (c00.b * (1 - fx) + c10.b * fx) * (1 - fy) + (c01.b * (1 - fx) + c11.b * fx) * fy;

    return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
  }

  applyToLines(lines, time) {
    this.precomputeGrid(time);

    const lineCount = lines.length;
    const result = new Array(lineCount);

    for (let i = 0; i < lineCount; i++) {
      const line = lines[i];
      const lineLength = line.length || 1;
      const v = i / lineCount;

      const chars = new Array(lineLength);

      for (let charIndex = 0; charIndex < lineLength; charIndex++) {
        const char = line[charIndex];
        const u = charIndex / lineLength;

        const color = this.getColorAtUV(u, v);
        const glowColor = `rgb(${color.r},${color.g},${color.b})`;
        chars[charIndex] = `<span style="color:${glowColor}">${char}</span>`;
      }

      result[i] = chars.join('');
    }

    return result.join('\n');
  }
}
