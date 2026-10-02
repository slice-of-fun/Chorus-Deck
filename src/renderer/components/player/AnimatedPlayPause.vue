<template>
  <div
    class="animated-play-pause"
    :class="{ 'is-clicked': isClicked }"
    @mousedown="handleMouseDown"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseUp"
    @touchstart="handleMouseDown"
    @touchend="handleMouseUp"
    @click="onClick"
  >
    <div class="background-container" :class="{ 'is-playing': isPlaying }">
      <svg viewBox="0 0 100 100" class="wavy-bg">
        <path :d="pathData" :fill="computedBgColor" />
      </svg>
    </div>
    <div class="icon-container">
      <i :class="isPlaying ? pauseIcon : playIcon" :style="{ color: computedIconColor }"></i>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

const props = defineProps({
  isPlaying: {
    type: Boolean,
    default: false
  },
  playIcon: {
    type: String,
    default: 'ri-play-fill'
  },
  pauseIcon: {
    type: String,
    default: 'ri-pause-fill'
  },
  bgColor: {
    type: String,
    default: ''
  },
  iconColor: {
    type: String,
    default: ''
  }
});

// Compute colors for the Material You look
const computedBgColor = computed(() => {
  if (props.bgColor) return `color-mix(in srgb, ${props.bgColor} 35%, white)`;
  return 'color-mix(in srgb, var(--primary-color, #ff6b6b) 35%, white)';
});

const computedIconColor = computed(() => {
  if (props.iconColor) return props.iconColor;
  if (props.bgColor) return props.bgColor;
  return 'var(--primary-color, #ff6b6b)';
});

const emit = defineEmits(['click']);

const isClicked = ref(false);

const handleMouseDown = () => {
  isClicked.value = true;
};

const handleMouseUp = () => {
  isClicked.value = false;
};

const onClick = (e: MouseEvent) => {
  emit('click', e);
};

// Animation state
const currentIndent = ref(props.isPlaying ? 0.15 : 0);
let animationFrame: number | null = null;
const targetIndent = computed(() => (props.isPlaying ? 0.15 : 0));

// Smooth transition for the indent (morphing effect)
const updateIndent = () => {
  const diff = targetIndent.value - currentIndent.value;
  if (Math.abs(diff) > 0.001) {
    currentIndent.value += diff * 0.15; // ease-out approach
    animationFrame = requestAnimationFrame(updateIndent);
  } else {
    currentIndent.value = targetIndent.value;
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }
};

watch(
  () => props.isPlaying,
  () => {
    if (!animationFrame) {
      animationFrame = requestAnimationFrame(updateIndent);
    }
  }
);

onUnmounted(() => {
  if (animationFrame) cancelAnimationFrame(animationFrame);
});

const pathData = computed(() => {
  const points = 8;
  const steps = 360;
  const radius = 46;
  const indent = currentIndent.value;
  let d = '';

  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * 2 * Math.PI;
    // Smoother, fewer points to avoid the sharp jagged gear look.
    const r = radius * (1 - indent * (0.5 - 0.5 * Math.cos(points * theta)));

    const x = 50 + r * Math.cos(theta);
    const y = 50 + r * Math.sin(theta);

    if (i === 0) {
      d += `M ${x} ${y} `;
    } else {
      d += `L ${x} ${y} `;
    }
  }
  d += 'Z';
  return d;
});
</script>

<style scoped>
.animated-play-pause {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  cursor: pointer;
  border-radius: 50%;
  transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.animated-play-pause.is-clicked {
  transform: scale(0.85);
}

.background-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transition: transform 0.3s ease;
  transform: scale(0.95);
}

.background-container.is-playing {
  transform: scale(1);
}

.wavy-bg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.icon-container {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

@keyframes spin-slow {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.background-container.is-playing .wavy-bg {
  animation: spin-slow 8s linear infinite;
  transform-origin: center center;
}
</style>
