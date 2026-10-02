<template>
  <div
    class="w-80 rounded-2xl bg-black/30 backdrop-blur-3xl border border-white/10 shadow-2xl overflow-hidden"
    :style="{ '--accent': accentColor }"
  >
    <div class="px-6 py-4 border-b border-white/5">
      <h2 class="text-lg font-semibold tracking-tight text-white/90">Lyric Settings</h2>
    </div>

    <div class="px-4 pt-3 pb-2">
      <div class="flex gap-1 p-1 bg-black/20 rounded-xl">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          @click="activeTab = tab.key"
          :class="[
            'flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200',
            activeTab === tab.key ? 'text-white shadow-lg' : 'hover:bg-white/5'
          ]"
          :style="[
            activeTab !== tab.key ? { color: 'rgba(255, 255, 255, 0.7)' } : {},
            activeTab === tab.key
              ? {
                  backgroundColor: accentColor,
                  boxShadow: `0 4px 14px 0 color-mix(in srgb, ${accentColor} 40%, transparent)`
                }
              : {}
          ]"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <div
      class="px-3 pb-3 max-h-[450px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent"
    >
      <div v-show="activeTab === 'display'" class="space-y-2 pt-2">
        <n-tooltip trigger="hover" placement="top" :style="{ maxWidth: '280px' }">
          <template #trigger>
            <div class="setting-item cursor-help">
              <span>Pure Mode</span>
              <input type="checkbox" v-model="config.pureModeEnabled" class="toggle-switch" />
            </div>
          </template>
          Hides the control buttons at the corners of the play page. Hover over their original
          position to bring them back, or turn it off in Settings → Playback
        </n-tooltip>
        <div class="setting-item">
          <span>Hide Cover</span>
          <input type="checkbox" v-model="config.hideCover" class="toggle-switch" />
        </div>
        <div class="setting-item">
          <span>Center Display</span>
          <input type="checkbox" v-model="config.centerLyrics" class="toggle-switch" />
        </div>
        <div class="setting-item">
          <span>Show Translation</span>
          <input type="checkbox" v-model="config.showTranslation" class="toggle-switch" />
        </div>
        <div class="setting-item">
          <span>Show Romaji</span>
          <input type="checkbox" v-model="config.showRoma" class="toggle-switch" />
        </div>
        <div class="setting-item">
          <span>Hide Lyrics</span>
          <input type="checkbox" v-model="config.hideLyrics" class="toggle-switch" />
        </div>
        <div class="setting-item">
          <span>Focus Current Lyric</span>
          <input type="checkbox" v-model="config.focusCurrentLyric" class="toggle-switch" />
        </div>
        <div class="setting-item">
          <span>Feather Lyric Edge</span>
          <input type="checkbox" v-model="config.featherEdge" class="toggle-switch" />
        </div>
      </div>

      <div v-show="activeTab === 'interface'" class="space-y-4 pt-3">
        <div class="setting-item">
          <span>Show Mini Play Bar</span>
          <input type="checkbox" v-model="showMiniPlayBar" class="toggle-switch" />
        </div>

        <div class="slider-group">
          <label class="slider-label">Content Width</label>
          <input
            type="range"
            v-model.number="config.contentWidth"
            min="50"
            max="100"
            step="5"
            class="slider-dynamic"
            :style="{ '--accent': accentColor }"
          />
          <div class="slider-marks">
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      <div v-show="activeTab === 'typography'" class="space-y-4 pt-3">
        <div class="slider-group">
          <label class="slider-label">Font Size</label>
          <input
            type="range"
            v-model.number="config.fontSize"
            min="12"
            max="32"
            step="1"
            class="slider-dynamic"
            :style="{ '--accent': accentColor }"
          />
          <div class="slider-marks">
            <span>Small</span>
            <span>Medium</span>
            <span>Large</span>
          </div>
        </div>

        <div class="slider-group">
          <label class="slider-label">Letter Spacing</label>
          <input
            type="range"
            v-model.number="config.letterSpacing"
            min="-2"
            max="10"
            step="0.2"
            class="slider-dynamic"
            :style="{ '--accent': accentColor }"
          />
          <div class="slider-marks">
            <span>Compact</span>
            <span>Default</span>
            <span>Loose</span>
          </div>
        </div>

        <div class="slider-group">
          <label class="slider-label">Font Weight</label>
          <input
            type="range"
            v-model.number="config.fontWeight"
            min="100"
            max="900"
            step="100"
            class="slider-dynamic"
            :style="{ '--accent': accentColor }"
          />
          <div class="slider-marks">
            <span>Thin</span>
            <span>Normal</span>
            <span>Bold</span>
          </div>
        </div>

        <div class="slider-group">
          <label class="slider-label">Line Height</label>
          <input
            type="range"
            v-model.number="config.lineHeight"
            min="1"
            max="3"
            step="0.1"
            class="slider-dynamic"
            :style="{ '--accent': accentColor }"
          />
          <div class="slider-marks">
            <span>Compact</span>
            <span>Default</span>
            <span>Loose</span>
          </div>
        </div>
      </div>

      <div v-show="activeTab === 'background'" class="space-y-4 pt-3">
        <div class="setting-item">
          <span>Use Custom Background</span>
          <input type="checkbox" v-model="config.useCustomBackground" class="toggle-switch" />
        </div>

        <div v-if="!config.useCustomBackground" class="radio-group">
          <label class="radio-label">Background Theme</label>
          <div class="space-y-2">
            <label class="radio-item">
              <input type="radio" v-model="config.theme" value="default" class="radio-input" />
              <span>Default</span>
            </label>
            <label class="radio-item">
              <input type="radio" v-model="config.theme" value="light" class="radio-input" />
              <span>Light</span>
            </label>
            <label class="radio-item">
              <input type="radio" v-model="config.theme" value="dark" class="radio-input" />
              <span>Dark</span>
            </label>
          </div>
        </div>

        <div v-if="config.useCustomBackground" class="radio-group">
          <label class="radio-label">Background Mode</label>
          <div class="grid grid-cols-2 gap-2">
            <label class="radio-item-compact">
              <input
                type="radio"
                v-model="config.backgroundMode"
                value="solid"
                class="radio-input"
              />
              <span>Solid</span>
            </label>
            <label class="radio-item-compact">
              <input
                type="radio"
                v-model="config.backgroundMode"
                value="gradient"
                class="radio-input"
              />
              <span>Gradient</span>
            </label>
            <label class="radio-item-compact">
              <input
                type="radio"
                v-model="config.backgroundMode"
                value="image"
                class="radio-input"
              />
              <span>Image</span>
            </label>
            <label class="radio-item-compact">
              <input type="radio" v-model="config.backgroundMode" value="css" class="radio-input" />
              <span>CSS</span>
            </label>
          </div>
        </div>

        <div
          v-if="config.useCustomBackground && config.backgroundMode === 'solid'"
          class="color-picker-group"
        >
          <label class="color-picker-label">Select Color</label>
          <input type="color" v-model="config.solidColor" class="color-picker" />
        </div>

        <div
          v-if="config.useCustomBackground && config.backgroundMode === 'gradient'"
          class="space-y-3"
        >
          <label class="color-picker-label">Gradient Editor</label>
          <div class="flex flex-wrap gap-2">
            <div v-for="(_, index) in config.gradientColors.colors" :key="index" class="relative">
              <input
                type="color"
                v-model="config.gradientColors.colors[index]"
                class="color-picker-small"
              />
              <button
                v-if="config.gradientColors.colors.length > 2"
                @click="removeGradientColor(index)"
                class="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs hover:bg-red-600 transition-colors"
              >
                <i class="ri-close-line"></i>
              </button>
            </div>
          </div>

          <button
            v-if="config.gradientColors.colors.length < 5"
            @click="addGradientColor"
            :style="{ backgroundColor: `color-mix(in srgb, ${accentColor} 20%, transparent)` }"
            class="w-full py-2 px-4 rounded-lg hover:brightness-110 transition-all text-sm font-medium flex items-center justify-center gap-2 text-white/90"
          >
            <i class="ri-add-line"></i>
            Add Color
          </button>

          <div class="select-group">
            <label class="select-label">Gradient Direction</label>
            <select v-model="config.gradientColors.direction" class="select-input">
              <option v-for="opt in gradientDirectionOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
        </div>

        <div
          v-if="config.useCustomBackground && config.backgroundMode === 'image'"
          class="space-y-3"
        >
          <label class="color-picker-label">Upload Image</label>
          <input type="file" accept="image/*" class="select-input" @change="handleImageUpload" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, reactive, ref } from 'vue';

import { playMusic } from '@/hooks/MusicHook';
import { DEFAULT_LYRIC_CONFIG, type LyricConfig } from '@/types/lyric';

const accentColor = computed(
  () => playMusic.value?.primaryColor || 'var(--primary-color, #6366f1)'
);

const config = inject<LyricConfig>(
  'lyricSetting',
  reactive<LyricConfig>({ ...DEFAULT_LYRIC_CONFIG })
);

const activeTab = ref('display');
const tabs = [
  { key: 'display', label: 'Display' },
  { key: 'interface', label: 'Interface' },
  { key: 'typography', label: 'Typography' },
  { key: 'background', label: 'Background' }
];

const showMiniPlayBar = ref(false);

const gradientDirectionOptions = [
  { label: 'To Right', value: 'to right' },
  { label: 'To Bottom', value: 'to bottom' },
  { label: 'To Bottom Right', value: 'to bottom right' }
];

const addGradientColor = () => {
  if (config.gradientColors.colors.length < 5) {
    config.gradientColors.colors.push('#ffffff');
  }
};

const removeGradientColor = (index: number) => {
  if (config.gradientColors.colors.length > 2) {
    config.gradientColors.colors.splice(index, 1);
  }
};

const handleImageUpload = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      config.backgroundImage = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
};

// Exposed so MusicFull / MusicFullCompact can read and persist lyric config.
defineExpose({ config });
</script>

<style scoped>
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  transition: all 0.2s;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
}

.setting-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.toggle-switch {
  appearance: none;
  width: 44px;
  height: 24px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  position: relative;
  cursor: pointer;
  transition: all 0.3s;
}

.toggle-switch::before {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  left: 2px;
  top: 2px;
  transition: all 0.3s;
}

.toggle-switch:checked {
  background: var(--accent, #6366f1);
}

.toggle-switch:checked::before {
  left: 22px;
}

.slider-group {
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}

.slider-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.8);
  opacity: 0.8;
  margin-bottom: 8px;
}

.slider-dynamic {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  outline: none;
  appearance: none;
}

.slider-dynamic::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  background: var(--accent, #6366f1);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--accent, #6366f1) 40%, transparent);
}

.slider-dynamic::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: var(--accent, #6366f1);
  border-radius: 50%;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--accent, #6366f1) 40%, transparent);
}

.slider-marks {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
  opacity: 0.5;
}

.radio-group {
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
}

.radio-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.8);
  opacity: 0.7;
  margin-bottom: 12px;
}

.radio-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
}

.radio-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.radio-item-compact {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.radio-item-compact:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.1);
}

.radio-input {
  appearance: none;
  width: 18px;
  height: 18px;
  border: 2px solid var(--text-color-primary);
  opacity: 0.4;
  border-radius: 50%;
  margin-right: 12px;
  position: relative;
  cursor: pointer;
  flex-shrink: 0;
}

.radio-input:checked {
  border-color: var(--accent, #6366f1);
  opacity: 1;
}

.radio-input:checked::before {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
  background: var(--accent, #6366f1);
  border-radius: 50%;
  left: 2px;
  top: 2px;
}

.color-picker-group {
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
}

.color-picker-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.8);
  opacity: 0.7;
  margin-bottom: 12px;
}

.color-picker {
  width: 100%;
  height: 48px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  background: transparent;
}

.color-picker::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-picker::-webkit-color-swatch {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}

.color-picker-small {
  width: 56px;
  height: 56px;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  background: transparent;
}

.color-picker-small::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-picker-small::-webkit-color-swatch {
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
}

.select-group {
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
}

.select-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.8);
  opacity: 0.7;
  margin-bottom: 12px;
}

.select-input {
  width: 100%;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  cursor: pointer;
  outline: none;
}

.select-input:focus {
  border-color: var(--accent, #6366f1);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #6366f1) 10%, transparent);
}

.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>
