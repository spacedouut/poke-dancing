// Fire effect control panel component

export class FireControlPanel {
  constructor(onSettingsChange) {
    this.onSettingsChange = onSettingsChange;
    this.panel = null;
    this.isOpen = false;
    this.settings = {
      mode: 'auto', // 'auto', 'webgl', 'cpu', 'original'
      quality: 'high', // 'low', 'medium', 'high'
      showGlow: false,
      glowIntensity: 15,
      showStats: true
    };
  }

  create() {
    const panel = document.createElement('div');
    panel.id = 'fire-control-panel';
    panel.className = 'fire-panel';
    panel.innerHTML = `
      <div class="fire-panel-header">
        <h3>🔥 Fire Options</h3>
        <button class="fire-panel-close" id="fire-panel-close">×</button>
      </div>

      <div class="fire-panel-content">
        <div class="fire-section">
          <label class="fire-label">Renderer</label>
          <select id="fire-mode" class="fire-select">
            <option value="auto">Auto (Best Available)</option>
            <option value="webgl">WebGL GPU</option>
            <option value="cpu">Optimized CPU</option>
            <option value="original">Original (Slow)</option>
          </select>
        </div>

        <div class="fire-section" id="fire-quality-section">
          <label class="fire-label">Quality (CPU Mode)</label>
          <div class="fire-radio-group">
            <label class="fire-radio">
              <input type="radio" name="quality" value="low">
              <span>Low (20×20)</span>
            </label>
            <label class="fire-radio">
              <input type="radio" name="quality" value="medium">
              <span>Medium (40×40)</span>
            </label>
            <label class="fire-radio">
              <input type="radio" name="quality" value="high" checked>
              <span>High (60×60)</span>
            </label>
          </div>
        </div>

        <div class="fire-section">
          <label class="fire-label">
            <input type="checkbox" id="fire-glow" class="fire-checkbox">
            Enable Glow Effect
          </label>
        </div>

        <div class="fire-section" id="fire-glow-intensity-section" style="display: none;">
          <label class="fire-label">Glow Intensity</label>
          <input type="range" id="fire-glow-intensity" class="fire-slider"
                 min="5" max="30" value="15" step="1">
          <span id="fire-glow-value" class="fire-value">15px</span>
        </div>

        <div class="fire-section">
          <label class="fire-label">
            <input type="checkbox" id="fire-stats" class="fire-checkbox" checked>
            Show Performance Stats
          </label>
        </div>

        <div class="fire-section fire-info" id="fire-info-section">
          <div class="fire-info-row">
            <span class="fire-info-label">Current Mode:</span>
            <span class="fire-info-value" id="fire-current-mode">-</span>
          </div>
          <div class="fire-info-row">
            <span class="fire-info-label">FPS:</span>
            <span class="fire-info-value" id="fire-current-fps">-</span>
          </div>
          <div class="fire-info-row">
            <span class="fire-info-label">Frame Time:</span>
            <span class="fire-info-value" id="fire-current-frametime">-</span>
          </div>
          <div class="fire-info-row">
            <span class="fire-info-label">Frame Budget:</span>
            <span class="fire-info-value" id="fire-frame-budget">-</span>
          </div>
          <div class="fire-info-row">
            <span class="fire-info-label">Characters:</span>
            <span class="fire-info-value" id="fire-char-count">-</span>
          </div>
          <div class="fire-info-row">
            <span class="fire-info-label">Color Zones:</span>
            <span class="fire-info-value" id="fire-current-zones">-</span>
          </div>
          <div class="fire-info-row">
            <span class="fire-info-label">Shader Calls:</span>
            <span class="fire-info-value" id="fire-shader-calls">-</span>
          </div>
          <div class="fire-info-row">
            <span class="fire-info-label">DOM Updates:</span>
            <span class="fire-info-value" id="fire-dom-time">-</span>
          </div>
          <div class="fire-info-row">
            <span class="fire-info-label">Avg FPS (60f):</span>
            <span class="fire-info-value" id="fire-avg-fps">-</span>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    this.panel = panel;
    this.attachListeners();
    return panel;
  }

  attachListeners() {
    // Close button
    document.getElementById('fire-panel-close').addEventListener('click', () => {
      this.toggle();
    });

    // Mode selector
    document.getElementById('fire-mode').addEventListener('change', (e) => {
      this.settings.mode = e.target.value;
      this.updateQualityVisibility();
      this.notifyChange();
    });

    // Quality radio buttons
    document.querySelectorAll('input[name="quality"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.settings.quality = e.target.value;
        this.notifyChange();
      });
    });

    // Glow checkbox
    document.getElementById('fire-glow').addEventListener('change', (e) => {
      this.settings.showGlow = e.target.checked;
      document.getElementById('fire-glow-intensity-section').style.display =
        e.target.checked ? 'block' : 'none';
      this.notifyChange();
    });

    // Glow intensity slider
    document.getElementById('fire-glow-intensity').addEventListener('input', (e) => {
      this.settings.glowIntensity = parseInt(e.target.value);
      document.getElementById('fire-glow-value').textContent = `${e.target.value}px`;
      if (this.settings.showGlow) {
        this.notifyChange();
      }
    });

    // Stats checkbox
    document.getElementById('fire-stats').addEventListener('change', (e) => {
      this.settings.showStats = e.target.checked;
      document.getElementById('fire-info-section').style.display =
        e.target.checked ? 'block' : 'none';
      this.notifyChange();
    });
  }

  updateQualityVisibility() {
    const qualitySection = document.getElementById('fire-quality-section');
    qualitySection.style.display =
      (this.settings.mode === 'cpu' || this.settings.mode === 'auto') ? 'block' : 'none';
  }

  notifyChange() {
    if (this.onSettingsChange) {
      this.onSettingsChange(this.settings);
    }
  }

  toggle() {
    this.isOpen = !this.isOpen;
    if (this.panel) {
      this.panel.classList.toggle('fire-panel-open', this.isOpen);
    }
  }

  updateStats(stats) {
    if (!this.settings.showStats) return;

    const modeEl = document.getElementById('fire-current-mode');
    const fpsEl = document.getElementById('fire-current-fps');
    const frametimeEl = document.getElementById('fire-current-frametime');
    const budgetEl = document.getElementById('fire-frame-budget');
    const charCountEl = document.getElementById('fire-char-count');
    const zonesEl = document.getElementById('fire-current-zones');
    const shaderCallsEl = document.getElementById('fire-shader-calls');
    const domTimeEl = document.getElementById('fire-dom-time');
    const avgFpsEl = document.getElementById('fire-avg-fps');

    if (modeEl) modeEl.textContent = stats.mode || '-';

    if (fpsEl && stats.fps) {
      const fps = stats.fps.toFixed(1);
      fpsEl.textContent = fps;
      fpsEl.className = 'fire-info-value';
      if (stats.fps >= 55) fpsEl.classList.add('fire-good');
      else if (stats.fps >= 25) fpsEl.classList.add('fire-warning');
      else fpsEl.classList.add('fire-bad');
    }

    if (frametimeEl && stats.frameTime) {
      const ft = stats.frameTime.toFixed(2);
      frametimeEl.textContent = `${ft}ms`;
      frametimeEl.className = 'fire-info-value';
      if (stats.frameTime < 16.67) frametimeEl.classList.add('fire-good');
      else if (stats.frameTime < 33.33) frametimeEl.classList.add('fire-warning');
      else frametimeEl.classList.add('fire-bad');
    }

    if (budgetEl && stats.frameTime) {
      const target = 33.33; // 30fps
      const used = (stats.frameTime / target * 100).toFixed(0);
      budgetEl.textContent = `${used}% of 33ms`;
      budgetEl.className = 'fire-info-value';
      if (used < 50) budgetEl.classList.add('fire-good');
      else if (used < 100) budgetEl.classList.add('fire-warning');
      else budgetEl.classList.add('fire-bad');
    }

    if (charCountEl) charCountEl.textContent = stats.charCount || '-';
    if (zonesEl) zonesEl.textContent = stats.colorZones || '-';
    if (shaderCallsEl) shaderCallsEl.textContent = stats.shaderCalls || '-';

    if (domTimeEl && stats.domTime) {
      domTimeEl.textContent = `${stats.domTime.toFixed(2)}ms`;
      domTimeEl.className = 'fire-info-value';
      if (stats.domTime < 10) domTimeEl.classList.add('fire-good');
      else if (stats.domTime < 20) domTimeEl.classList.add('fire-warning');
      else domTimeEl.classList.add('fire-bad');
    }

    if (avgFpsEl && stats.avgFps) {
      avgFpsEl.textContent = stats.avgFps.toFixed(1);
      avgFpsEl.className = 'fire-info-value';
      if (stats.avgFps >= 55) avgFpsEl.classList.add('fire-good');
      else if (stats.avgFps >= 25) avgFpsEl.classList.add('fire-warning');
      else avgFpsEl.classList.add('fire-bad');
    }
  }

  getSettings() {
    return { ...this.settings };
  }
}

// Create toggle button
export function createPanelToggleButton(panel) {
  const button = document.createElement('button');
  button.id = 'fire-panel-toggle';
  button.className = 'fire-toggle-btn';
  button.innerHTML = '⚙️';
  button.title = 'Fire Effect Options';

  button.addEventListener('click', () => {
    panel.toggle();
  });

  document.body.appendChild(button);
  return button;
}
