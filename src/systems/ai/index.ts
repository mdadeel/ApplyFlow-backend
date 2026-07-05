import { AIProvider } from './aiProvider'
import { MockAIProvider } from './mockProvider'
import { OllamaAIProvider } from './ollamaProvider'
import { OpenAIAIProvider } from './openaiProvider'
import { config } from '../../config'
import { getPreferences } from '../identity/preferenceStore'

function createProvider(): AIProvider {
  if (config.aiProvider === 'ollama') {
    return new OllamaAIProvider()
  }
  if (config.aiProvider === 'openai' && config.aiApiKey) {
    return new OpenAIAIProvider()
  }
  return new MockAIProvider()
}

let provider: AIProvider = createProvider()

export function getAIProvider(): AIProvider {
  return provider
}

export function setAIProvider(p: AIProvider) {
  provider = p
}

/**
 * Resolve an AI provider for a specific user.
 *
 * For Ollama, if the user has set a custom `OLLAMA_URL` we honor that URL.
 * For OpenAI/OpenRouter, the user's API key from preferences is plumbed through.
 * Falls back to MockAIProvider when no key or provider is configured.
 */
export async function getAIProviderForUser(userId: string): Promise<AIProvider> {
  const preferences = await getPreferences(userId).catch(() => null)
  const ollamaUrl = preferences?.apiKeys?.OLLAMA_URL

  if (config.aiProvider === 'ollama') {
    if (ollamaUrl && typeof ollamaUrl === 'string' && ollamaUrl.trim().length > 0) {
      return new OllamaAIProvider(ollamaUrl.trim())
    }
    return new OllamaAIProvider()
  }

  // For OpenAI/OpenRouter, check per-user API key override
  if (config.aiProvider === 'openai') {
    const userKey = preferences?.apiKeys?.OPENAI_API_KEY
    if (userKey && typeof userKey === 'string' && userKey.trim().length > 0) {
      return new OpenAIAIProvider(undefined, userKey.trim())
    }
    if (config.aiApiKey) {
      return new OpenAIAIProvider()
    }
  }

  return new MockAIProvider()
}

export type { AIProvider }
