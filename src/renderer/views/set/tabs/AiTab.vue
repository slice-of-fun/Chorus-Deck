<template>
  <div>
    <setting-section title="AI Provider">
      <setting-item
        icon="ri-robot-2-line"
        title="AI Provider"
        description="Select the AI service provider"
      >
        <template #action>
          <s-select
            v-model="setData.aiProvider"
            :options="providerOptions"
            width="w-48 max-md:w-full"
          />
        </template>
      </setting-item>

      <setting-item
        v-if="setData.aiProvider === 'Custom'"
        icon="ri-link"
        title="Base URL"
        description="Custom API Base URL"
      >
        <template #action>
          <s-input
            v-model="setData.openRouterBaseUrl"
            placeholder="Enter base URL"
            width="w-64 max-md:w-full"
          />
        </template>
      </setting-item>
    </setting-section>

    <setting-section title="Setup Guide">
      <template v-if="setData.aiProvider === 'DeepL'">
        <setting-item
          icon="ri-key-line"
          title="DeepL API Key"
          description="Your DeepL authentication key"
        >
          <template #action>
            <s-input
              v-model="setData.deeplApiKey"
              type="text"
              placeholder="Enter DeepL API Key"
              width="w-64 max-md:w-full"
            />
          </template>
        </setting-item>

        <setting-item
          icon="ri-chat-check-line"
          title="DeepL Formality"
          description="Formality of translation"
        >
          <template #action>
            <s-select
              v-model="setData.deeplFormality"
              :options="formalityOptions"
              width="w-40 max-md:w-full"
            />
          </template>
        </setting-item>
      </template>

      <template v-else>
        <setting-item
          icon="ri-key-line"
          title="API Key"
          description="Your authentication key for the provider"
        >
          <template #action>
            <s-input
              v-model="setData.openRouterApiKey"
              type="text"
              placeholder="Enter API Key"
              width="w-64 max-md:w-full"
            />
          </template>
        </setting-item>

        <setting-item
          v-if="setData.aiProvider !== 'Custom'"
          icon="ri-cpu-line"
          title="Model"
          description="Select the AI model"
        >
          <template #action>
            <s-select
              v-model="setData.openRouterModel"
              :options="modelOptions"
              width="w-64 max-md:w-full"
            />
          </template>
        </setting-item>
      </template>
    </setting-section>

    <setting-section title="AI Lyrics Translation">
      <template v-if="setData.aiProvider !== 'DeepL'">
        <setting-item
          icon="ri-translate"
          title="Translation Mode"
          description="Choose translation style"
        >
          <template #action>
            <s-select
              v-model="setData.translateMode"
              :options="translateModeOptions"
              width="w-40 max-md:w-full"
            />
          </template>
        </setting-item>
      </template>

      <setting-item
        icon="ri-global-line"
        title="Target Language"
        description="Language for lyrics translation"
      >
        <template #action>
          <s-select
            v-model="setData.translateLanguage"
            :options="languageOptions"
            width="w-40 max-md:w-full"
          />
        </template>
      </setting-item>

      <setting-item
        icon="ri-magic-line"
        title="Auto Translate"
        description="Automatically translate lyrics"
      >
        <template #action>
          <n-switch v-model:value="setData.autoTranslate" />
        </template>
      </setting-item>
    </setting-section>

    <setting-section title="AI Recommendations">
      <setting-item
        icon="ri-lightbulb-flash-line"
        title="Enable Recommendations"
        description="Use AI to recommend similar songs"
      >
        <template #action>
          <n-switch v-model:value="setData.aiRecommendations" />
        </template>
      </setting-item>

      <setting-item
        v-if="setData.aiRecommendations"
        icon="ri-refresh-line"
        title="Refresh Recommendations"
        description="Manually refresh AI recommendations list"
      >
        <template #action>
          <n-button secondary round>
            <template #icon><i class="ri-refresh-line"></i></template>
            Refresh
          </n-button>
        </template>
      </setting-item>
    </setting-section>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, watch } from 'vue';

import { SETTINGS_DATA_KEY } from '../keys';
import SettingItem from '../SettingItem.vue';
import SettingSection from '../SettingSection.vue';
import SInput from '../SInput.vue';
import SSelect from '../SSelect.vue';

const setData = inject(SETTINGS_DATA_KEY)!;

const aiProviders: Record<string, string> = {
  OpenRouter: 'https://openrouter.ai/api/v1/chat/completions',
  OpenAI: 'https://api.openai.com/v1/chat/completions',
  Perplexity: 'https://api.perplexity.ai/chat/completions',
  Claude: 'https://api.anthropic.com/v1/messages',
  Gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  XAi: 'https://api.x.ai/v1/chat/completions',
  Mistral: 'https://api.mistral.ai/v1/chat/completions',
  Nvidia: 'https://integrate.api.nvidia.com/v1/chat/completions',
  Groq: 'https://api.groq.com/openai/v1/chat/completions',
  Puter: 'https://api.puter.com/puterai/openai/v1/chat/completions',
  DeepL: 'https://api.deepl.com/v2/translate',
  Custom: ''
};

const modelsByProvider: Record<string, string[]> = {
  OpenRouter: [
    'google/gemini-2.5-flash-lite',
    'google/gemini-2.5-flash',
    'x-ai/grok-4.1-fast',
    'deepseek/deepseek-v3.1-terminus:exacto',
    'openai/gpt-4o-mini',
    'google/gemini-3-flash-preview'
  ],
  OpenAI: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
  Claude: ['claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest', 'claude-3-opus-latest'],
  Gemini: [
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-3.5-flash',
    'gemini-3-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.1-pro'
  ],
  Perplexity: ['sonar', 'sonar-pro', 'sonar-reasoning'],
  XAi: ['grok-4-1-fast', 'grok-vision-beta'],
  Mistral: [
    'mistral-large-latest',
    'mistral-medium-latest',
    'mistral-small-latest',
    'mistral-tiny-latest'
  ],
  Nvidia: [
    'meta/llama-3.1-405b-instruct',
    'meta/llama-3.1-70b-instruct',
    'meta/llama-3.1-8b-instruct',
    'nvidia/nemotron-4-340b-instruct',
    'mistralai/mixtral-8x22b-instruct-v0.1'
  ],
  Groq: [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'moonshotai/kimi-k2-instruct',
    'qwen/qwen3-32b',
    'gemma2-9b-it'
  ],
  Puter: [
    'gpt-4o-mini',
    'claude-3-5-sonnet-latest',
    'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo'
  ],
  DeepL: [],
  Custom: []
};

const providerOptions = computed(() =>
  Object.keys(aiProviders).map((key) => ({ label: key, value: key }))
);

const modelOptions = computed(() => {
  const models = modelsByProvider[setData.value.aiProvider as string] || [];
  return models.map((m) => ({ label: m, value: m }));
});

const translateModeOptions = computed(() => [
  { label: 'Literal', value: 'Literal' },
  { label: 'Transcribed', value: 'Transcribed' }
]);

const languageOptions = computed(() => [
  { label: 'English', value: 'en' },
  { label: 'Chinese (Simplified)', value: 'zh-CN' },
  { label: 'Chinese (Traditional)', value: 'zh-TW' },
  { label: 'Japanese', value: 'ja' },
  { label: 'Korean', value: 'ko' },
  { label: 'Spanish', value: 'es' },
  { label: 'French', value: 'fr' },
  { label: 'German', value: 'de' },
  { label: 'Russian', value: 'ru' }
]);

const formalityOptions = computed(() => [
  { label: 'Default', value: 'default' },
  { label: 'More Formal', value: 'more' },
  { label: 'Less Formal', value: 'less' }
]);

watch(
  () => setData.value.aiProvider,
  (newProvider: string) => {
    if (newProvider !== 'Custom' && newProvider !== 'DeepL') {
      setData.value.openRouterBaseUrl = aiProviders[newProvider] || '';
    } else {
      setData.value.openRouterBaseUrl = '';
    }

    const modelsForProvider = modelsByProvider[newProvider] || [];
    setData.value.openRouterModel = modelsForProvider.length > 0 ? modelsForProvider[0] : '';
  }
);
</script>
