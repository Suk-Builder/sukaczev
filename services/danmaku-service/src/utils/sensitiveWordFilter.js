const logger = require('./logger');

class SensitiveWordFilter {
  constructor() {
    this.wordList = new Set();
    this.replacementChar = '*';
    this.isInitialized = false;
    this.pattern = null;
    this.loadWords();
  }

  /**
   * Load sensitive words from environment variable
   * Format: comma-separated list in SENSITIVE_WORDS env var
   */
  loadWords() {
    try {
      const envWords = process.env.SENSITIVE_WORDS || '';
      const words = envWords.split(',').map(w => w.trim().toLowerCase()).filter(Boolean);

      // Default word list if no env var set
      const defaultWords = [
        'spam', 'abuse', 'toxic', 'hate', ' racist',
        'sexist', 'homophobic', 'threat', 'violence',
        'illegal', 'fraud', 'scam', 'phishing',
        'spam', 'ads', 'promotion'
      ];

      const allWords = [...new Set([...defaultWords, ...words])];
      allWords.forEach(word => this.wordList.add(word));

      this.buildPattern();
      this.isInitialized = true;

      logger.info(`Sensitive word filter loaded with ${this.wordList.size} words`);
    } catch (error) {
      logger.error('Failed to load sensitive words:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Build regex pattern from word list
   */
  buildPattern() {
    if (this.wordList.size === 0) {
      this.pattern = null;
      return;
    }

    const escapedWords = Array.from(this.wordList).map(word =>
      word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );

    // Sort by length (longest first) to avoid partial matches
    escapedWords.sort((a, b) => b.length - a.length);

    this.pattern = new RegExp(`(${escapedWords.join('|')})`, 'gi');
  }

  /**
   * Check if text contains sensitive words
   * @param {string} text - Text to check
   * @returns {Object} Result with containsSensitive flag and matched words
   */
  check(text) {
    if (!this.isInitialized || !this.pattern || !text) {
      return { containsSensitive: false, matchedWords: [], cleanText: text || '' };
    }

    const matchedWords = [];
    const lowerText = text.toLowerCase();

    // Check each word individually for accurate matching
    this.wordList.forEach(word => {
      if (lowerText.includes(word)) {
        matchedWords.push(word);
      }
    });

    return {
      containsSensitive: matchedWords.length > 0,
      matchedWords: [...new Set(matchedWords)],
      cleanText: text
    };
  }

  /**
   * Filter sensitive words from text, replacing with replacement char
   * @param {string} text - Text to filter
   * @returns {Object} Filtered text and metadata
   */
  filter(text) {
    if (!this.isInitialized || !this.pattern || !text) {
      return {
        filtered: false,
        original: text || '',
        filteredText: text || '',
        matchedWords: []
      };
    }

    const checkResult = this.check(text);

    if (!checkResult.containsSensitive) {
      return {
        filtered: false,
        original: text,
        filteredText: text,
        matchedWords: []
      };
    }

    let filteredText = text;

    // Replace each matched word
    checkResult.matchedWords.forEach(word => {
      const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      filteredText = filteredText.replace(regex, match =>
        this.replacementChar.repeat(match.length)
      );
    });

    logger.debug(`Filtered sensitive words: ${checkResult.matchedWords.join(', ')}`);

    return {
      filtered: true,
      original: text,
      filteredText,
      matchedWords: checkResult.matchedWords
    };
  }

  /**
   * Add words to the filter
   * @param {string|string[]} words - Word(s) to add
   */
  addWords(words) {
    const wordArray = Array.isArray(words) ? words : [words];
    wordArray.forEach(word => {
      if (word && word.trim()) {
        this.wordList.add(word.trim().toLowerCase());
      }
    });
    this.buildPattern();
    logger.info(`Added ${wordArray.length} words to sensitive filter`);
  }

  /**
   * Remove words from the filter
   * @param {string|string[]} words - Word(s) to remove
   */
  removeWords(words) {
    const wordArray = Array.isArray(words) ? words : [words];
    wordArray.forEach(word => {
      this.wordList.delete(word.trim().toLowerCase());
    });
    this.buildPattern();
    logger.info(`Removed ${wordArray.length} words from sensitive filter`);
  }

  /**
   * Get current word list
   * @returns {string[]} Array of sensitive words
   */
  getWords() {
    return Array.from(this.wordList);
  }

  /**
   * Get filter statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      totalWords: this.wordList.size,
      isInitialized: this.isInitialized,
      wordList: this.getWords()
    };
  }

  /**
   * Validate danmaku content
   * @param {string} content - Content to validate
   * @returns {Object} Validation result
   */
  validateContent(content) {
    const maxLength = parseInt(process.env.DANMAKU_MAX_LENGTH, 10) || 100;

    if (!content || typeof content !== 'string') {
      return { valid: false, error: 'Content is required' };
    }

    if (content.trim().length === 0) {
      return { valid: false, error: 'Content cannot be empty' };
    }

    if (content.length > maxLength) {
      return { valid: false, error: `Content exceeds maximum length of ${maxLength} characters` };
    }

    const filterResult = this.filter(content);

    if (filterResult.filtered && filterResult.matchedWords.length > 0) {
      return {
        valid: true,
        filtered: true,
        content: filterResult.filteredText,
        matchedWords: filterResult.matchedWords,
        warning: 'Content contains sensitive words and has been filtered'
      };
    }

    return {
      valid: true,
      filtered: false,
      content,
      matchedWords: []
    };
  }
}

module.exports = new SensitiveWordFilter();
