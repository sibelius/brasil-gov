import type { AppConfig } from '@mlc-ai/web-llm'

export const MODEL_ID = 'Qwen3-0.6B-q4f16_1-MLC'
export const MODEL_NAME = 'Qwen3 0.6B'
export const MODEL_REVISION = '8c14ce481d4c692769976ad52afea453a102df19'
export const MODEL_LIB_REVISION = '025bcaf3780fa8254f5e5efd3bfea0a5397248f4'
export const MAX_PROMPT_LENGTH = 1000
export const TEST_PROMPT =
  'Explique em duas frases, em português, por que é importante conferir a fonte de uma informação.'

export const MODEL_CONFIG: AppConfig = {
  cacheBackend: 'cache',
  model_list: [
    {
      model_id: MODEL_ID,
      model: `https://huggingface.co/mlc-ai/${MODEL_ID}/resolve/${MODEL_REVISION}/`,
      model_lib: `https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/${MODEL_LIB_REVISION}/web-llm-models/v0_2_84/base/Qwen3-0.6B-q4f16_1_cs1k-webgpu.wasm`,
      required_features: ['shader-f16'],
      overrides: { context_window_size: 2048 },
    },
  ],
}
