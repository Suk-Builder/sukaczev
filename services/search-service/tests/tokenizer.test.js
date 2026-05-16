const { HybridTokenizer, getTokenizer } = require('../src/utils/tokenizer');

describe('HybridTokenizer', () => {
  let tokenizer;

  beforeEach(() => {
    tokenizer = new HybridTokenizer();
  });

  describe('tokenize', () => {
    describe('English text', () => {
      it('should tokenize simple English text', () => {
        const tokens = tokenizer.tokenize('Hello World');
        expect(tokens).toContain('hello');
        expect(tokens).toContain('world');
      });

      it('should handle empty string', () => {
        const tokens = tokenizer.tokenize('');
        expect(tokens).toEqual([]);
      });

      it('should handle null input', () => {
        const tokens = tokenizer.tokenize(null);
        expect(tokens).toEqual([]);
      });

      it('should handle undefined input', () => {
        const tokens = tokenizer.tokenize(undefined);
        expect(tokens).toEqual([]);
      });

      it('should convert to lowercase', () => {
        const tokens = tokenizer.tokenize('HELLO WORLD');
        expect(tokens).toContain('hello');
        expect(tokens).toContain('world');
      });

      it('should remove extra whitespace', () => {
        const tokens = tokenizer.tokenize('  hello   world  ');
        expect(tokens).toContain('hello');
        expect(tokens).toContain('world');
      });

      it('should handle text with punctuation', () => {
        const tokens = tokenizer.tokenize('Hello, world! How are you?');
        expect(tokens).toContain('hello');
        expect(tokens).toContain('world');
        expect(tokens).toContain('how');
        expect(tokens).toContain('are');
        expect(tokens).toContain('you');
      });

      it('should handle numbers', () => {
        const tokens = tokenizer.tokenize('Version 2.0 released in 2024');
        expect(tokens).toContain('version');
        expect(tokens).toContain('2');
        expect(tokens).toContain('0');
        expect(tokens).toContain('released');
        expect(tokens).toContain('in');
        expect(tokens).toContain('2024');
      });

      it('should handle camelCase', () => {
        const tokens = tokenizer.tokenize('camelCaseText');
        expect(tokens.some((t) => t.includes('camel'))).toBeTruthy();
      });

      it('should handle underscores', () => {
        const tokens = tokenizer.tokenize('hello_world_test');
        expect(tokens).toContain('hello');
        expect(tokens).toContain('world');
        expect(tokens).toContain('test');
      });

      it('should handle hyphenated words', () => {
        const tokens = tokenizer.tokenize('well-known fact');
        expect(tokens).toContain('well');
        expect(tokens).toContain('known');
        expect(tokens).toContain('fact');
      });

      it('should handle programming code', () => {
        const tokens = tokenizer.tokenize('const x = 5; // comment');
        expect(tokens).toContain('const');
        expect(tokens).toContain('x');
        expect(tokens).toContain('5');
        expect(tokens).toContain('comment');
      });

      it('should handle URLs', () => {
        const tokens = tokenizer.tokenize('Check https://example.com/page');
        expect(tokens).toContain('check');
        expect(tokens).toContain('https');
        expect(tokens).toContain('example');
        expect(tokens).toContain('com');
        expect(tokens).toContain('page');
      });

      it('should handle email addresses', () => {
        const tokens = tokenizer.tokenize('Email me at test@example.com');
        expect(tokens).toContain('email');
        expect(tokens).toContain('me');
        expect(tokens).toContain('at');
        expect(tokens).toContain('test');
        expect(tokens).toContain('example');
        expect(tokens).toContain('com');
      });
    });

    describe('Chinese text', () => {
      it('should tokenize Chinese text into characters', () => {
        const tokens = tokenizer.tokenize('你好世界');
        // Should include individual characters
        expect(tokens).toContain('你好');
        expect(tokens.length).toBeGreaterThan(0);
      });

      it('should handle mixed Chinese and English', () => {
        const tokens = tokenizer.tokenize('Python编程教程');
        expect(tokens).toContain('python');
        expect(tokens.length).toBeGreaterThan(1);
      });

      it('should handle Chinese punctuation', () => {
        const tokens = tokenizer.tokenize('你好，世界！这是测试。');
        expect(tokens.length).toBeGreaterThan(0);
        // Should not include pure punctuation
        expect(tokens).not.toContain('，');
        expect(tokens).not.toContain('！');
        expect(tokens).not.toContain('。');
      });

      it('should handle Chinese with spaces', () => {
        const tokens = tokenizer.tokenize('你好 世界 测试');
        expect(tokens.length).toBeGreaterThan(0);
      });

      it('should handle common Chinese phrases', () => {
        const tokens = tokenizer.tokenize('机器学习入门教程');
        expect(tokens).toContain('机器学习');
        expect(tokens).toContain('学习');
        expect(tokens).toContain('入门');
        expect(tokens).toContain('教程');
      });

      it('should handle Chinese numbers', () => {
        const tokens = tokenizer.tokenize('2024年新年');
        expect(tokens).toContain('2024');
        expect(tokens).toContain('年');
      });
    });

    describe('Edge cases', () => {
      it('should handle very long text', () => {
        const longText = 'a'.repeat(10000);
        const tokens = tokenizer.tokenize(longText);
        expect(tokens.length).toBeGreaterThan(0);
      });

      it('should handle single character', () => {
        const tokens = tokenizer.tokenize('a');
        expect(tokens).toContain('a');
      });

      it('should handle only punctuation', () => {
        const tokens = tokenizer.tokenize('!!!???...,,,');
        expect(tokens.length).toBe(0);
      });

      it('should handle only whitespace', () => {
        const tokens = tokenizer.tokenize('     \n\t   ');
        expect(tokens).toEqual([]);
      });

      it('should handle non-string input (number)', () => {
        const tokens = tokenizer.tokenize(12345);
        expect(tokens).toEqual([]);
      });

      it('should handle non-string input (object)', () => {
        const tokens = tokenizer.tokenize({ key: 'value' });
        expect(tokens).toEqual([]);
      });
    });
  });

  describe('extractBigrams', () => {
    it('should extract bigrams from English text', () => {
      const bigrams = tokenizer.extractBigrams('Hello World Python');
      expect(bigrams.length).toBeGreaterThan(0);
    });

    it('should handle short text', () => {
      const bigrams = tokenizer.extractBigrams('Hi');
      expect(bigrams).toEqual([]);
    });

    it('should handle empty text', () => {
      const bigrams = tokenizer.extractBigrams('');
      expect(bigrams).toEqual([]);
    });
  });

  describe('generateSuggestions', () => {
    it('should return empty array for empty query', () => {
      const suggestions = tokenizer.generateSuggestions('');
      expect(suggestions).toEqual([]);
    });

    it('should return empty array for null query', () => {
      const suggestions = tokenizer.generateSuggestions(null);
      expect(suggestions).toEqual([]);
    });

    it('should generate suggestions for English query', () => {
      const suggestions = tokenizer.generateSuggestions('hello');
      expect(suggestions).toContain('hello');
    });

    it('should generate prefix suggestions', () => {
      const suggestions = tokenizer.generateSuggestions('hello world');
      // Should include the full query
      expect(suggestions).toContain('hello world');
    });

    it('should deduplicate suggestions', () => {
      const suggestions = tokenizer.generateSuggestions('test test test');
      const uniqueSuggestions = [...new Set(suggestions)];
      expect(suggestions).toEqual(uniqueSuggestions);
    });

    it('should generate suggestions for Chinese query', () => {
      const suggestions = tokenizer.generateSuggestions('编程');
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should filter short suggestions', () => {
      const suggestions = tokenizer.generateSuggestions('ab');
      // Suggestions should be at least 2 chars
      expect(suggestions.every((s) => s.length >= 2)).toBe(true);
    });
  });

  describe('Internal methods', () => {
    describe('_containsChinese', () => {
      it('should return true for Chinese text', () => {
        expect(tokenizer._containsChinese('中文')).toBe(true);
      });

      it('should return false for English text', () => {
        expect(tokenizer._containsChinese('English')).toBe(false);
      });

      it('should return true for mixed text', () => {
        expect(tokenizer._containsChinese('English中文')).toBe(true);
      });

      it('should return false for empty string', () => {
        expect(tokenizer._containsChinese('')).toBe(false);
      });
    });

    describe('_simpleStem', () => {
      it('should stem -ing suffix', () => {
        expect(tokenizer._simpleStem('running')).toBe('runn');
      });

      it('should stem -ed suffix', () => {
        expect(tokenizer._simpleStem('tested')).toBe('test');
      });

      it('should stem -ies suffix', () => {
        expect(tokenizer._simpleStem('cities')).toBe('city');
      });

      it('should stem -s suffix', () => {
        expect(tokenizer._simpleStem('tests')).toBe('test');
      });

      it('should not stem short words', () => {
        expect(tokenizer._simpleStem('ing')).toBe('ing');
      });

      it('should return unknown words as-is', () => {
        expect(tokenizer._simpleStem('test')).toBe('test');
      });
    });
  });
});

describe('getTokenizer singleton', () => {
  it('should return the same instance', () => {
    const tokenizer1 = getTokenizer();
    const tokenizer2 = getTokenizer();
    expect(tokenizer1).toBe(tokenizer2);
  });
});
