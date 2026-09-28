<template>
  <div class="eq-control p-6 rounded-lg bg-gray-100 dark:bg-gray-900 w-full max-w-[700px]">
    <div class="eq-header flex justify-between items-center mb-4">
      <h3 class="text-xl font-semibold text-gray-800 dark:text-gray-200">
        Equalizer
        <n-tag type="warning" size="small" round v-if="!isElectron">
          The desktop version is available, but the web version is not supported.
        </n-tag>
      </h3>
      <div class="eq-controls">
        <n-switch v-model:value="isEnabled" @update:value="toggleEQ">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </div>
    </div>

    <div class="eq-presets mb-2 relative h-10">
      <n-scrollbar x-scrollable>
        <n-space :size="6" :wrap="false">
          <n-tag
            v-for="preset in presetOptions"
            :key="preset.value"
            :type="currentPreset === preset.value ? 'success' : 'default'"
            :bordered="false"
            size="medium"
            round
            clickable
            @click="applyPreset(preset.value)"
          >
            {{ preset.label }}
          </n-tag>
        </n-space>
      </n-scrollbar>
    </div>

    <div
      class="eq-sliders flex justify-between items-end bg-gray-50 dark:bg-gray-800 gap-1 rounded-lg p-2 h-[300px]"
    >
      <div
        v-for="freq in frequencies"
        :key="freq"
        class="eq-slider flex flex-col items-center w-[45px] h-full"
      >
        <div
          class="freq-label text-xs font-medium text-center text-gray-600 dark:text-gray-400 whitespace-nowrap m-2 h-5"
        >
          {{ formatFreq(freq) }}
        </div>
        <n-slider
          v-model:value="eqValues[freq.toString()]"
          :min="-12"
          :max="12"
          :step="0.1"
          vertical
          :disabled="!isEnabled"
          @update:value="updateEQ(freq.toString(), $event)"
          class="flex-1 my-3 min-h-[180px]"
        />
        <div
          class="gain-value text-xs font-medium text-center text-gray-600 dark:text-gray-400 whitespace-nowrap my-1 h-4"
        >
          {{ eqValues[freq.toString()] }}dB
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';

import { audioService } from '@/services/audioService';
import { isElectron } from '@/utils';

const frequencies = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const eqValues = ref<{ [key: string]: number }>({});
const isEnabled = ref(audioService.isEQEnabled());
const currentPreset = ref(audioService.getCurrentPreset() || 'flat');

const presets = {
  flat: {
    label: 'Flat',
    values: Object.fromEntries(frequencies.map((f) => [f, 0]))
  },
  pop: {
    label: 'Pop',
    values: {
      31: -1.5,
      62: 3.5,
      125: 5.5,
      250: 3.5,
      500: -0.5,
      1000: -1.5,
      2000: 1.5,
      4000: 2.5,
      8000: 2.5,
      16000: 2.5
    }
  },
  rock: {
    label: 'Rock',
    values: {
      31: 4.5,
      62: 3.5,
      125: 2,
      250: 0.5,
      500: -0.5,
      1000: -1,
      2000: 0.5,
      4000: 2,
      8000: 2.5,
      16000: 3.5
    }
  },
  classical: {
    label: 'Classical',
    values: {
      31: 3.5,
      62: 3,
      125: 2.5,
      250: 1.5,
      500: -0.5,
      1000: -1.5,
      2000: -1.5,
      4000: 0.5,
      8000: 2,
      16000: 3
    }
  },
  jazz: {
    label: 'Jazz',
    values: {
      31: 3,
      62: 2,
      125: 1.5,
      250: 2,
      500: -1,
      1000: -1.5,
      2000: -0.5,
      4000: 1,
      8000: 2.5,
      16000: 3
    }
  },
  hiphop: {
    label: 'Hip-Hop',
    values: {
      31: 5,
      62: 4.5,
      125: 3,
      250: 1.5,
      500: -0.5,
      1000: -1,
      2000: 0.5,
      4000: 1.5,
      8000: 2,
      16000: 2.5
    }
  },
  vocal: {
    label: 'Vocal',
    values: {
      31: -2,
      62: -1.5,
      125: -1,
      250: 0.5,
      500: 2,
      1000: 3.5,
      2000: 3,
      4000: 1.5,
      8000: 0.5,
      16000: 0
    }
  },
  dance: {
    label: 'Dance',
    values: {
      31: 4,
      62: 3.5,
      125: 2.5,
      250: 1,
      500: 0,
      1000: -0.5,
      2000: 1.5,
      4000: 2.5,
      8000: 3,
      16000: 2.5
    }
  },
  acoustic: {
    label: 'Acoustic',
    values: {
      31: 2,
      62: 1.5,
      125: 1,
      250: 1.5,
      500: 2,
      1000: 1.5,
      2000: 2,
      4000: 2.5,
      8000: 2,
      16000: 1.5
    }
  }
};

const presetOptions = Object.entries(presets).map(([value, preset]) => ({
  label: preset.label,
  value
}));

const toggleEQ = (enabled: boolean) => {
  audioService.setEQEnabled(enabled);
};

const applyPreset = (presetName: string) => {
  currentPreset.value = presetName;
  audioService.setCurrentPreset(presetName);
  const preset = presets[presetName as keyof typeof presets];
  if (preset) {
    Object.entries(preset.values).forEach(([freq, gain]) => {
      updateEQ(freq, gain);
    });
  }
};

onMounted(() => {
  const settings = audioService.getAllEQSettings();
  eqValues.value = settings;

  const savedPreset = audioService.getCurrentPreset();
  if (savedPreset && presets[savedPreset as keyof typeof presets]) {
    currentPreset.value = savedPreset;
  }
});

const updateEQ = (frequency: string, gain: number) => {
  audioService.setEQFrequencyGain(frequency, gain);
  eqValues.value = {
    ...eqValues.value,
    [frequency]: gain
  };

  const currentValues = eqValues.value;
  let matchedPreset: string | null = null;

  Object.entries(presets).forEach(([presetName, preset]) => {
    const isMatch = Object.entries(preset.values).every(
      ([freq, value]) => Math.abs(currentValues[freq] - value) < 0.1
    );
    if (isMatch) {
      matchedPreset = presetName;
    }
  });

  if (matchedPreset !== null) {
    currentPreset.value = matchedPreset;
    audioService.setCurrentPreset(matchedPreset);
  } else if (currentPreset.value !== 'custom') {
    currentPreset.value = 'custom';
    audioService.setCurrentPreset('custom');
  }
};

const formatFreq = (freq: number) => {
  if (freq >= 1000) {
    return `${freq / 1000}kHz`;
  }
  return `${freq}Hz`;
};
</script>

<style lang="scss" scoped>
:deep(.n-scrollbar) {
  margin-left: -0.5rem;
  margin-right: -0.5rem;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}

:deep(.n-tag) {
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;

  &:hover {
    transform: translateY(-2px);
  }
}

:deep(.n-space) {
  flex-wrap: nowrap;
  padding: 4px 0;
}

:deep(.n-slider) {
  --n-rail-height: 4px;
  --n-rail-color: #e5e7eb;
  --n-rail-color-hover: #d1d5db;
  --n-fill-color: rgb(var(--color-primary));
  --n-fill-color-hover: #16a34a;
  --n-handle-color: rgb(var(--color-primary));
  --n-handle-box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  .n-slider-handle {
    transition: all 0.2s;
    &:hover {
      transform: scale(1.2);
    }
  }
}
</style>
