const config = require('../config');
const logger = require('./logger');

/**
 * Simple Chinese + English tokenizer implementation
 * Since node-jieba might have native dependency issues, we implement
 * a hybrid tokenizer that handles both Chinese and English text
 */
class HybridTokenizer {
  constructor() {
    this.jieba = null;
    this.useJieba = false;
    this.init();
  }

  async init() {
    try {
      // Try to use node-jieba for Chinese tokenization
      const { load, cut } = require('node-jieba');
      load();
      this.jieba = { cut };
      this.useJieba = true;
      logger.info('Using node-jieba for Chinese tokenization');
    } catch (error) {
      logger.warn('node-jieba not available, using fallback tokenizer for Chinese');
      this.useJieba = false;
    }
  }

  /**
   * Tokenize text into individual terms
   * @param {string} text - Input text to tokenize
   * @returns {string[]} - Array of tokens
   */
  tokenize(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const normalizedText = text.toLowerCase().trim();

    if (this.useJieba && this._containsChinese(normalizedText)) {
      return this._tokenizeWithJieba(normalizedText);
    }

    return this._tokenizeFallback(normalizedText);
  }

  /**
   * Extract bigrams for phrase matching
   * @param {string} text - Input text
   * @returns {string[]} - Array of bigrams
   */
  extractBigrams(text) {
    const tokens = this.tokenize(text);
    const bigrams = [];
    for (let i = 0; i < tokens.length - 1; i++) {
      bigrams.push(`${tokens[i]}${tokens[i + 1]}`);
    }
    return bigrams;
  }

  /**
   * Generate search suggestions from query
   * @param {string} query - Partial query text
   * @returns {string[]} - Suggestion tokens
   */
  generateSuggestions(query) {
    if (!query || query.length < 1) {
      return [];
    }

    const tokens = this.tokenize(query);
    const suggestions = [];

    // Add full query
    suggestions.push(query.toLowerCase().trim());

    // Add individual tokens
    tokens.forEach((token) => {
      if (token.length >= 2) {
        suggestions.push(token);
      }
    });

    // Add prefix combinations
    const normalizedQuery = query.toLowerCase().trim();
    for (let i = 2; i <= normalizedQuery.length; i++) {
      const prefix = normalizedQuery.substring(0, i);
      if (prefix.length >= 2 && !suggestions.includes(prefix)) {
        suggestions.push(prefix);
      }
    }

    return [...new Set(suggestions)];
  }

  /**
   * Check if text contains Chinese characters
   */
  _containsChinese(text) {
    return /[\u4e00-\u9fff]/.test(text);
  }

  /**
   * Tokenize using Jieba
   */
  _tokenizeWithJieba(text) {
    try {
      const tokens = this.jieba.cut(text, true);
      // Filter out empty tokens, single punctuation, and very short tokens
      return tokens.filter((token) => {
        if (!token || token.trim().length === 0) return false;
        if (/^[，。！？、；：\"\'（）《》【】]+$/.test(token)) return false;
        return token.length >= 1;
      });
    } catch (error) {
      logger.error('Jieba tokenization error:', error.message);
      return this._tokenizeFallback(text);
    }
  }

  /**
   * Fallback tokenizer for English + basic Chinese
   */
  _tokenizeFallback(text) {
    const tokens = [];

    // Split by whitespace and punctuation
    const segments = text.split(/[\s\n\r\t]+/);

    for (const segment of segments) {
      if (!segment) continue;

      if (this._containsChinese(segment)) {
        // For Chinese text, split into individual characters and character pairs
        const chars = segment.split('');
        // Add individual Chinese characters that are not punctuation
        for (const char of chars) {
          if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(char)) {
            tokens.push(char);
          }
        }
        // Add overlapping bigrams for Chinese
        for (let i = 0; i < chars.length - 1; i++) {
          const bigram = chars[i] + chars[i + 1];
          if (/[\u4e00-\u9fff\u3400-\u4dbf]{2}/.test(bigram)) {
            tokens.push(bigram);
          }
        }
      } else {
        // For English/alphanumeric, handle word splitting
        const words = segment.split(/[^a-z0-9\u00c0-\u024f]+/i);
        for (const word of words) {
          if (word && word.length >= 1) {
            tokens.push(word.toLowerCase());
            // Also add stemmed version for common suffixes
            const stemmed = this._simpleStem(word.toLowerCase());
            if (stemmed !== word.toLowerCase()) {
              tokens.push(stemmed);
            }
          }
        }
      }
    }

    return [...new Set(tokens)].filter((t) => t.length > 0);
  }

  /**
   * Simple English stemming
   */
  _simpleStem(word) {
    const suffixes = [
      'ing', 'ly', 'ed', 'ies', 'ied', 'ies', 'ied', 's',
    ];
    for (const suffix of suffixes) {
      if (word.endsWith(suffix) && word.length > suffix.length + 2) {
        if (suffix === 'ies') return word.slice(0, -3) + 'y';
        if (suffix === 'ied') return word.slice(0, -3) + 'y';
        return word.slice(0, -suffix.length);
      }
    }
    return word;
  }
}

// Singleton instance
let tokenizerInstance = null;

const getTokenizer = () => {
  if (!tokenizerInstance) {
    tokenizerInstance = new HybridTokenizer();
  }
  return tokenizerInstance;
};

module.exports = {
  HybridTokenizer,
  getTokenizer,
};
