<template>
  <div class="notch playing-notch" @mouseenter="isHovered = true" @mouseleave="isHovered = false">
    <div class="artwork-container">
      <svg class="curvy-progress" viewBox="0 0 36 36" v-show="progressPercent !== undefined">
        <path class="circle-bg" :d="wavyRing" pathLength="100" />
        <path class="circle"
          pathLength="100"
          :stroke-dasharray="`${progressPercent}, 100`"
          :d="wavyRing"
        />
      </svg>
      <div class="artwork-small" :style="{ clipPath: artworkClip }" v-if="currentTrack?.cover && failedCover !== currentTrack.cover">
        <img :src="currentTrack.cover" crossorigin="anonymous" referrerpolicy="no-referrer" @error="failedCover = currentTrack.cover" />
      </div>
      <div class="artwork-small placeholder" :style="{ clipPath: artworkClip }" v-else>
        <i class="ri-music-2-line"></i>
      </div>
    </div>

    <div class="visualizer">
      <div v-for="i in 4" :key="i" class="bar"></div>
    </div>

    <div class="notch-icon" :style="{ clipPath: artworkClip }">
      <canvas ref="logoCanvas" width="56" height="56" style="width: 100%; height: 100%;"></canvas>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PropType, ref, watch, onMounted } from 'vue';
import darkLogoPath from '@/assets/logo-dark.png';
import lightLogoPath from '@/assets/logo-inverted.png';

type RGB = [number, number, number];

const props = defineProps({
  currentTrack: {
    type: Object as PropType<{ title?: string; artist?: string; cover?: string; backgroundColor?: string }>,
    default: () => ({})
  },
  progressPercent: {
    type: Number,
    default: 0
  },
  isDark: {
    type: Boolean,
    default: true
  },
  accentColor: {
    type: String,
    default: ''
  }
});

const isHovered = ref(false);
const failedCover = ref('');
const logoCanvas = ref<HTMLCanvasElement | null>(null);

// Shared wave shape so the ring and the artwork curves line up exactly
const LOBES = 10;
const AMP = 1.1; // wave depth in px
const wavyPoints = (cx: number, cy: number, R: number, steps = 180) => {
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const r = R + AMP * Math.cos(LOBES * t);
    pts.push([cx + r * Math.sin(t), cy - r * Math.cos(t)]);
  }
  return pts;
};

// Artwork: 28px box, outer lobe tips touch the edge
const ART_R = 14 - AMP;
const artworkClip = `polygon(${wavyPoints(14, 14, ART_R)
  .map(([x, y]) => `${((x / 28) * 100).toFixed(2)}% ${((y / 28) * 100).toFixed(2)}%`)
  .join(', ')})`;

// Ring: in the 36-unit svg (artwork offset by 4), concentric with a small gap
const wavyRing = wavyPoints(18, 18, ART_R + 2.3)
  .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`)
  .join(' ');

// Parse "hsl(h, s%, l%)" or "rgb(r,g,b)" -> [r,g,b]
const parseColor = (color: string): RGB => {
  const tmp = document.createElement('div');
  tmp.style.color = color;
  document.body.appendChild(tmp);
  const computed = getComputedStyle(tmp).color;
  document.body.removeChild(tmp);
  const m = computed.match(/\d+/g);
  if (m && m.length >= 3) return [+m[0], +m[1], +m[2]];
  return [128, 128, 128];
};

const hslFromRgb = ([r, g, b]: RGB): [number, number, number] => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
};

const hslToRgb = (h: number, s: number, l: number): RGB => {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
};

const drawLogo = () => {
  const canvas = logoCanvas.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const src = props.isDark ? darkLogoPath : lightLogoPath;

  let darkColor: RGB = props.isDark ? [30, 20, 40] : [240, 235, 250];
  let lightColor: RGB = props.isDark ? [220, 200, 255] : [40, 20, 60];

  if (props.accentColor) {
    const base = parseColor(props.accentColor);
    const [h, s] = hslFromRgb(base);
    const sat = Math.max(s, 40);
    darkColor = hslToRgb(h, sat, props.isDark ? 18 : 82);
    lightColor = hslToRgb(h, sat, props.isDark ? 82 : 18);
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    // Step 1: do pixel manipulation at the image's full native resolution
    const offscreen = document.createElement('canvas');
    offscreen.width = img.naturalWidth || 128;
    offscreen.height = img.naturalHeight || 128;
    const offCtx = offscreen.getContext('2d')!;
    offCtx.drawImage(img, 0, 0);

    const imageData = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a < 10) continue;
      const brightness = (r + g + b) / 3;

      let target: RGB;
      if (props.isDark) {
        if (brightness < 80)       target = darkColor;
        else if (brightness > 180) target = lightColor;
        else {
          const t = (brightness - 80) / 100;
          target = [
            Math.round(darkColor[0] + t * (lightColor[0] - darkColor[0])),
            Math.round(darkColor[1] + t * (lightColor[1] - darkColor[1])),
            Math.round(darkColor[2] + t * (lightColor[2] - darkColor[2])),
          ];
        }
      } else {
        if (brightness > 180)     target = lightColor;
        else if (brightness < 80) target = darkColor;
        else {
          const t = (brightness - 80) / 100;
          target = [
            Math.round(darkColor[0] + t * (lightColor[0] - darkColor[0])),
            Math.round(darkColor[1] + t * (lightColor[1] - darkColor[1])),
            Math.round(darkColor[2] + t * (lightColor[2] - darkColor[2])),
          ];
        }
      }
      data[i] = target[0]; data[i+1] = target[1]; data[i+2] = target[2];
    }
    offCtx.putImageData(imageData, 0, 0);

    // Step 2: scale down to display canvas at devicePixelRatio for crisp rendering
    const dpr = window.devicePixelRatio || 2;
    const displayPx = 28;
    canvas.width = displayPx * dpr;
    canvas.height = displayPx * dpr;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
  };
  img.src = src;
};

onMounted(drawLogo);
watch(() => [props.isDark, props.accentColor], drawLogo);
</script>

<style scoped>
.playing-notch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 100%;
}


.artwork-container {
  position: relative;
  width: 28px;
  height: 28px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.curvy-progress {
  position: absolute;
  top: -4px;
  left: -4px;
  width: 36px;
  height: 36px;
  z-index: 1;
  pointer-events: none;
}

.circle-bg {
  fill: none;
  stroke: var(--island-text, #fff);
  opacity: 0.2;
  stroke-width: 3;
}

.circle {
  fill: none;
  stroke: var(--island-accent, #f1ebd9);
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: stroke-dasharray 0.3s ease;
}

.artwork-small {
  width: 28px;
  height: 28px;
  overflow: hidden;
  background: var(--bg-color-200, #222);
  position: relative;
  z-index: 2;
}

.artwork-small img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.placeholder {
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--text-color, #fff);
  font-size: 14px;
}

.notch-icon {
  width: 28px;
  height: 28px;
  display: flex;
  justify-content: center;
  align-items: center;
}



.scalloped {
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M 195.00 100.00 L 194.67 103.31 L 193.69 106.55 L 192.14 109.68 L 190.11 112.66 L 187.76 115.47 L 185.23 118.12 L 182.67 120.61 L 180.25 123.01 L 178.09 125.37 L 176.28 127.77 L 174.89 130.26 L 173.91 132.91 L 173.33 135.76 L 173.06 138.85 L 173.02 142.16 L 173.06 145.65 L 173.06 149.28 L 172.87 152.95 L 172.39 156.55 L 171.50 159.99 L 170.14 163.16 L 168.29 165.94 L 165.94 168.29 L 163.16 170.14 L 159.99 171.50 L 156.55 172.39 L 152.95 172.87 L 149.28 173.06 L 145.65 173.06 L 142.16 173.02 L 138.85 173.06 L 135.76 173.33 L 132.91 173.91 L 130.26 174.89 L 127.77 176.28 L 125.37 178.09 L 123.01 180.25 L 120.61 182.67 L 118.12 185.23 L 115.47 187.76 L 112.66 190.11 L 109.68 192.14 L 106.55 193.69 L 103.31 194.67 L 100.00 195.00 L 96.69 194.67 L 93.45 193.69 L 90.32 192.14 L 87.34 190.11 L 84.53 187.76 L 81.88 185.23 L 79.39 182.67 L 76.99 180.25 L 74.63 178.09 L 72.23 176.28 L 69.74 174.89 L 67.09 173.91 L 64.24 173.33 L 61.15 173.06 L 57.84 173.02 L 54.35 173.06 L 50.72 173.06 L 47.05 172.87 L 43.45 172.39 L 40.01 171.50 L 36.84 170.14 L 34.06 168.29 L 31.71 165.94 L 29.86 163.16 L 28.50 159.99 L 27.61 156.55 L 27.13 152.95 L 26.94 149.28 L 26.94 145.65 L 26.98 142.16 L 26.94 138.85 L 26.67 135.76 L 26.09 132.91 L 25.11 130.26 L 23.72 127.77 L 21.91 125.37 L 19.75 123.01 L 17.33 120.61 L 14.77 118.12 L 12.24 115.47 L 9.89 112.66 L 7.86 109.68 L 6.31 106.55 L 5.33 103.31 L 5.00 100.00 L 5.33 96.69 L 6.31 93.45 L 7.86 90.32 L 9.89 87.34 L 12.24 84.53 L 14.77 81.88 L 17.33 79.39 L 19.75 76.99 L 21.91 74.63 L 23.72 72.23 L 25.11 69.74 L 26.09 67.09 L 26.67 64.24 L 26.94 61.15 L 26.98 57.84 L 26.94 54.35 L 26.94 50.72 L 27.13 47.05 L 27.61 43.45 L 28.50 40.01 L 29.86 36.84 L 31.71 34.06 L 34.06 31.71 L 36.84 29.86 L 40.01 28.50 L 43.45 27.61 L 47.05 27.13 L 50.72 26.94 L 54.35 26.94 L 57.84 26.98 L 61.15 26.94 L 64.24 26.67 L 67.09 26.09 L 69.74 25.11 L 72.23 23.72 L 74.63 21.91 L 76.99 19.75 L 79.39 17.33 L 81.88 14.77 L 84.53 12.24 L 87.34 9.89 L 90.32 7.86 L 93.45 6.31 L 96.69 5.33 L 100.00 5.00 L 103.31 5.33 L 106.55 6.31 L 109.68 7.86 L 112.66 9.89 L 115.47 12.24 L 118.12 14.77 L 120.61 17.33 L 123.01 19.75 L 125.37 21.91 L 127.77 23.72 L 130.26 25.11 L 132.91 26.09 L 135.76 26.67 L 138.85 26.94 L 142.16 26.98 L 145.65 26.94 L 149.28 26.94 L 152.95 27.13 L 156.55 27.61 L 159.99 28.50 L 163.16 29.86 L 165.94 31.71 L 168.29 34.06 L 170.14 36.84 L 171.50 40.01 L 172.39 43.45 L 172.87 47.05 L 173.06 50.72 L 173.06 54.35 L 173.02 57.84 L 173.06 61.15 L 173.33 64.24 L 173.91 67.09 L 174.89 69.74 L 176.28 72.23 L 178.09 74.63 L 180.25 76.99 L 182.67 79.39 L 185.23 81.88 L 187.76 84.53 L 190.11 87.34 L 192.14 90.32 L 193.69 93.45 L 194.67 96.69 L 195.00 100.00 Z'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M 195.00 100.00 L 194.67 103.31 L 193.69 106.55 L 192.14 109.68 L 190.11 112.66 L 187.76 115.47 L 185.23 118.12 L 182.67 120.61 L 180.25 123.01 L 178.09 125.37 L 176.28 127.77 L 174.89 130.26 L 173.91 132.91 L 173.33 135.76 L 173.06 138.85 L 173.02 142.16 L 173.06 145.65 L 173.06 149.28 L 172.87 152.95 L 172.39 156.55 L 171.50 159.99 L 170.14 163.16 L 168.29 165.94 L 165.94 168.29 L 163.16 170.14 L 159.99 171.50 L 156.55 172.39 L 152.95 172.87 L 149.28 173.06 L 145.65 173.06 L 142.16 173.02 L 138.85 173.06 L 135.76 173.33 L 132.91 173.91 L 130.26 174.89 L 127.77 176.28 L 125.37 178.09 L 123.01 180.25 L 120.61 182.67 L 118.12 185.23 L 115.47 187.76 L 112.66 190.11 L 109.68 192.14 L 106.55 193.69 L 103.31 194.67 L 100.00 195.00 L 96.69 194.67 L 93.45 193.69 L 90.32 192.14 L 87.34 190.11 L 84.53 187.76 L 81.88 185.23 L 79.39 182.67 L 76.99 180.25 L 74.63 178.09 L 72.23 176.28 L 69.74 174.89 L 67.09 173.91 L 64.24 173.33 L 61.15 173.06 L 57.84 173.02 L 54.35 173.06 L 50.72 173.06 L 47.05 172.87 L 43.45 172.39 L 40.01 171.50 L 36.84 170.14 L 34.06 168.29 L 31.71 165.94 L 29.86 163.16 L 28.50 159.99 L 27.61 156.55 L 27.13 152.95 L 26.94 149.28 L 26.94 145.65 L 26.98 142.16 L 26.94 138.85 L 26.67 135.76 L 26.09 132.91 L 25.11 130.26 L 23.72 127.77 L 21.91 125.37 L 19.75 123.01 L 17.33 120.61 L 14.77 118.12 L 12.24 115.47 L 9.89 112.66 L 7.86 109.68 L 6.31 106.55 L 5.33 103.31 L 5.00 100.00 L 5.33 96.69 L 6.31 93.45 L 7.86 90.32 L 9.89 87.34 L 12.24 84.53 L 14.77 81.88 L 17.33 79.39 L 19.75 76.99 L 21.91 74.63 L 23.72 72.23 L 25.11 69.74 L 26.09 67.09 L 26.67 64.24 L 26.94 61.15 L 26.98 57.84 L 26.94 54.35 L 26.94 50.72 L 27.13 47.05 L 27.61 43.45 L 28.50 40.01 L 29.86 36.84 L 31.71 34.06 L 34.06 31.71 L 36.84 29.86 L 40.01 28.50 L 43.45 27.61 L 47.05 27.13 L 50.72 26.94 L 54.35 26.94 L 57.84 26.98 L 61.15 26.94 L 64.24 26.67 L 67.09 26.09 L 69.74 25.11 L 72.23 23.72 L 74.63 21.91 L 76.99 19.75 L 79.39 17.33 L 81.88 14.77 L 84.53 12.24 L 87.34 9.89 L 90.32 7.86 L 93.45 6.31 L 96.69 5.33 L 100.00 5.00 L 103.31 5.33 L 106.55 6.31 L 109.68 7.86 L 112.66 9.89 L 115.47 12.24 L 118.12 14.77 L 120.61 17.33 L 123.01 19.75 L 125.37 21.91 L 127.77 23.72 L 130.26 25.11 L 132.91 26.09 L 135.76 26.67 L 138.85 26.94 L 142.16 26.98 L 145.65 26.94 L 149.28 26.94 L 152.95 27.13 L 156.55 27.61 L 159.99 28.50 L 163.16 29.86 L 165.94 31.71 L 168.29 34.06 L 170.14 36.84 L 171.50 40.01 L 172.39 43.45 L 172.87 47.05 L 173.06 50.72 L 173.06 54.35 L 173.02 57.84 L 173.06 61.15 L 173.33 64.24 L 173.91 67.09 L 174.89 69.74 L 176.28 72.23 L 178.09 74.63 L 180.25 76.99 L 182.67 79.39 L 185.23 81.88 L 187.76 84.53 L 190.11 87.34 L 192.14 90.32 L 193.69 93.45 L 194.67 96.69 L 195.00 100.00 Z'/%3E%3C/svg%3E");
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
}

.visualizer {
  display: flex;
  align-items: center;
  gap: 3px;
  height: 20px;
}

.visualizer .bar {
  width: 3px;
  border-radius: 2px;
  background-color: var(--island-accent, #f1ebd9);
  transform-origin: center;
  animation: equalize 1s infinite alternate ease-in-out;
}

.visualizer .bar:nth-child(1) {
  height: 10px;
  animation-delay: 0.1s;
}
.visualizer .bar:nth-child(2) {
  height: 16px;
  animation-delay: 0.3s;
}
.visualizer .bar:nth-child(3) {
  height: 12px;
  animation-delay: 0.2s;
}
.visualizer .bar:nth-child(4) {
  height: 18px;
  animation-delay: 0.4s;
}

@keyframes equalize {
  0% {
    transform: scaleY(0.3);
  }
  100% {
    transform: scaleY(1);
  }
}
</style>
