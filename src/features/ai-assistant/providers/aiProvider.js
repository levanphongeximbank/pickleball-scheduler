/**
 * Interface cho external AI provider — không bắt buộc.
 * @typedef {Object} AiExplainInput
 * @property {string} module
 * @property {Object} data
 * @property {string} [locale]
 */

/**
 * @typedef {Object} AiExplainOutput
 * @property {string} text
 * @property {number} [confidence]
 */

/**
 * @typedef {Object} AiProvider
 * @property {(input: AiExplainInput) => Promise<AiExplainOutput>} explain
 */

/** @type {AiProvider|null} */
let activeProvider = null;

export function setAiProvider(provider) {
  activeProvider = provider;
}

export function getAiProvider() {
  return activeProvider;
}

/**
 * Bổ sung giải thích từ external AI nếu có — fallback local text.
 * @param {AiExplainInput} input
 * @param {string} fallbackText
 */
export async function explainWithProvider(input, fallbackText) {
  if (!activeProvider?.explain) {
    return { text: fallbackText, fromProvider: false };
  }

  try {
    const result = await activeProvider.explain(input);
    return {
      text: result?.text || fallbackText,
      confidence: result?.confidence,
      fromProvider: true,
    };
  } catch {
    return { text: fallbackText, fromProvider: false };
  }
}
