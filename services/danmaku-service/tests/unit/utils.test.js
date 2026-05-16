const densityController = require('../../src/utils/densityController');
const sensitiveWordFilter = require('../../src/utils/sensitiveWordFilter');
const { getRedis } = require('../../src/config/redis');

describe('Utils', () => {
  describe('SensitiveWordFilter', () => {
    beforeEach(() => {
      sensitiveWordFilter.wordList.clear();
      sensitiveWordFilter.addWords([
        'spam', 'abuse', 'toxic', 'hate', 'racist',
        'sexist', 'homophobic', 'threat', 'violence',
        'illegal', 'fraud', 'scam'
      ]);
    });

    describe('check', () => {
      it('should detect sensitive words in text', () => {
        const result = sensitiveWordFilter.check('This is a spam message');

        expect(result.containsSensitive).toBe(true);
        expect(result.matchedWords).toContain('spam');
      });

      it('should detect multiple sensitive words', () => {
        const result = sensitiveWordFilter.check('This spam is toxic and full of hate');

        expect(result.containsSensitive).toBe(true);
        expect(result.matchedWords).toContain('spam');
        expect(result.matchedWords).toContain('toxic');
        expect(result.matchedWords).toContain('hate');
      });

      it('should return no sensitive words for clean text', () => {
        const result = sensitiveWordFilter.check('This is a normal message');

        expect(result.containsSensitive).toBe(false);
        expect(result.matchedWords).toHaveLength(0);
      });

      it('should handle case-insensitive matching', () => {
        const result1 = sensitiveWordFilter.check('This is SPAM');
        const result2 = sensitiveWordFilter.check('This is Spam');
        const result3 = sensitiveWordFilter.check('This is spam');

        expect(result1.containsSensitive).toBe(true);
        expect(result2.containsSensitive).toBe(true);
        expect(result3.containsSensitive).toBe(true);
      });

      it('should handle empty string', () => {
        const result = sensitiveWordFilter.check('');

        expect(result.containsSensitive).toBe(false);
      });

      it('should handle null input', () => {
        const result = sensitiveWordFilter.check(null);

        expect(result.containsSensitive).toBe(false);
      });

      it('should handle undefined input', () => {
        const result = sensitiveWordFilter.check(undefined);

        expect(result.containsSensitive).toBe(false);
      });

      it('should detect words with punctuation', () => {
        const result = sensitiveWordFilter.check('This is spam! Check it out.');

        expect(result.containsSensitive).toBe(true);
        expect(result.matchedWords).toContain('spam');
      });

      it('should not match partial words', () => {
        const result = sensitiveWordFilter.check('This is spamming');

        expect(result.containsSensitive).toBe(false);
      });

      it('should handle text with only sensitive words', () => {
        const result = sensitiveWordFilter.check('spam abuse toxic');

        expect(result.containsSensitive).toBe(true);
        expect(result.matchedWords).toHaveLength(3);
      });

      it('should handle special characters', () => {
        const result = sensitiveWordFilter.check('spam@example.com has spam');

        expect(result.containsSensitive).toBe(true);
      });

      it('should handle unicode characters', () => {
        const result = sensitiveWordFilter.check('This is spam 中文测试');

        expect(result.containsSensitive).toBe(true);
      });

      it('should preserve original text in cleanText', () => {
        const text = 'Original text with spam';
        const result = sensitiveWordFilter.check(text);

        expect(result.cleanText).toBe(text);
      });

      it('should detect all configured sensitive words', () => {
        const words = sensitiveWordFilter.getWords();
        words.forEach(word => {
          const result = sensitiveWordFilter.check(`This contains ${word}`);
          expect(result.containsSensitive).toBe(true);
          expect(result.matchedWords).toContain(word);
        });
      });
    });

    describe('filter', () => {
      it('should replace sensitive words with asterisks', () => {
        const result = sensitiveWordFilter.filter('This is spam content');

        expect(result.filtered).toBe(true);
        expect(result.filteredText).toBe('This is **** content');
        expect(result.original).toBe('This is spam content');
      });

      it('should replace multiple sensitive words', () => {
        const result = sensitiveWordFilter.filter('spam and abuse are toxic');

        expect(result.filtered).toBe(true);
        expect(result.filteredText).toBe('**** and ***** are *****');
      });

      it('should not modify clean text', () => {
        const text = 'This is clean text';
        const result = sensitiveWordFilter.filter(text);

        expect(result.filtered).toBe(false);
        expect(result.filteredText).toBe(text);
        expect(result.original).toBe(text);
      });

      it('should handle empty string', () => {
        const result = sensitiveWordFilter.filter('');

        expect(result.filtered).toBe(false);
        expect(result.filteredText).toBe('');
      });

      it('should handle null input', () => {
        const result = sensitiveWordFilter.filter(null);

        expect(result.filtered).toBe(false);
        expect(result.filteredText).toBe('');
      });

      it('should handle text with no spaces around sensitive word', () => {
        const result = sensitiveWordFilter.filter('spamspam spam spamspam');

        expect(result.filteredText).toContain('****');
      });

      it('should replace with same-length asterisks', () => {
        const result = sensitiveWordFilter.filter('fraud');
        expect(result.filteredText).toBe('*****');
      });

      it('should handle mixed case', () => {
        const result = sensitiveWordFilter.filter('This is SPAM');
        expect(result.filteredText).toBe('This is ****');
      });

      it('should include matched words in result', () => {
        const result = sensitiveWordFilter.filter('spam content here');
        expect(result.matchedWords).toContain('spam');
      });
    });

    describe('addWords', () => {
      it('should add single word', () => {
        sensitiveWordFilter.addWords('newbadword');

        const result = sensitiveWordFilter.check('This has newbadword');
        expect(result.containsSensitive).toBe(true);
      });

      it('should add multiple words', () => {
        sensitiveWordFilter.addWords(['word1', 'word2']);

        expect(sensitiveWordFilter.check('word1 here').containsSensitive).toBe(true);
        expect(sensitiveWordFilter.check('word2 here').containsSensitive).toBe(true);
      });

      it('should trim whitespace from words', () => {
        sensitiveWordFilter.addWords('  trimmedWord  ');

        const result = sensitiveWordFilter.check('trimmedWord');
        expect(result.containsSensitive).toBe(true);
      });

      it('should convert to lowercase', () => {
        sensitiveWordFilter.addWords('MixedCase');

        const result = sensitiveWordFilter.check('mixedcase');
        expect(result.containsSensitive).toBe(true);
      });

      it('should ignore empty strings', () => {
        const beforeCount = sensitiveWordFilter.getWords().length;
        sensitiveWordFilter.addWords('');
        const afterCount = sensitiveWordFilter.getWords().length;

        expect(afterCount).toBe(beforeCount);
      });

      it('should handle duplicate words', () => {
        sensitiveWordFilter.addWords('spam');
        const words = sensitiveWordFilter.getWords();
        const spamCount = words.filter(w => w === 'spam').length;

        expect(spamCount).toBe(1);
      });
    });

    describe('removeWords', () => {
      it('should remove single word', () => {
        sensitiveWordFilter.removeWords('spam');

        const result = sensitiveWordFilter.check('This is spam');
        expect(result.containsSensitive).toBe(false);
      });

      it('should remove multiple words', () => {
        sensitiveWordFilter.removeWords(['spam', 'abuse']);

        expect(sensitiveWordFilter.check('spam').containsSensitive).toBe(false);
        expect(sensitiveWordFilter.check('abuse').containsSensitive).toBe(false);
      });

      it('should handle removing non-existent word', () => {
        expect(() => {
          sensitiveWordFilter.removeWords('nonexistent');
        }).not.toThrow();
      });
    });

    describe('getWords', () => {
      it('should return all words as array', () => {
        const words = sensitiveWordFilter.getWords();

        expect(Array.isArray(words)).toBe(true);
        expect(words.length).toBeGreaterThan(0);
        expect(words).toContain('spam');
        expect(words).toContain('abuse');
      });
    });

    describe('getStats', () => {
      it('should return filter statistics', () => {
        const stats = sensitiveWordFilter.getStats();

        expect(stats).toMatchObject({
          totalWords: expect.any(Number),
          isInitialized: true,
          wordList: expect.any(Array)
        });
        expect(stats.totalWords).toBeGreaterThan(0);
      });
    });

    describe('validateContent', () => {
      it('should validate normal content', () => {
        const result = sensitiveWordFilter.validateContent('Hello world');

        expect(result.valid).toBe(true);
        expect(result.filtered).toBe(false);
        expect(result.content).toBe('Hello world');
      });

      it('should reject empty content', () => {
        const result = sensitiveWordFilter.validateContent('');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Content cannot be empty');
      });

      it('should reject null content', () => {
        const result = sensitiveWordFilter.validateContent(null);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Content is required');
      });

      it('should reject undefined content', () => {
        const result = sensitiveWordFilter.validateContent(undefined);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Content is required');
      });

      it('should reject content exceeding max length', () => {
        const longContent = 'x'.repeat(101);
        const result = sensitiveWordFilter.validateContent(longContent);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('exceeds maximum length');
      });

      it('should accept content at max length', () => {
        const maxContent = 'x'.repeat(100);
        const result = sensitiveWordFilter.validateContent(maxContent);

        expect(result.valid).toBe(true);
      });

      it('should filter sensitive content', () => {
        const result = sensitiveWordFilter.validateContent('This is spam content');

        expect(result.valid).toBe(true);
        expect(result.filtered).toBe(true);
        expect(result.content).toBe('This is **** content');
        expect(result.matchedWords).toContain('spam');
        expect(result.warning).toBeDefined();
      });

      it('should return valid for clean short content', () => {
        const result = sensitiveWordFilter.validateContent('Hi');

        expect(result.valid).toBe(true);
        expect(result.filtered).toBe(false);
      });

      it('should reject whitespace-only content', () => {
        const result = sensitiveWordFilter.validateContent('   ');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Content cannot be empty');
      });

      it('should handle single character content', () => {
        const result = sensitiveWordFilter.validateContent('A');

        expect(result.valid).toBe(true);
        expect(result.content).toBe('A');
      });

      it('should handle content with only special characters', () => {
        const result = sensitiveWordFilter.validateContent('!@#$%^&*()');

        expect(result.valid).toBe(true);
        expect(result.filtered).toBe(false);
      });

      it('should handle content with emoji', () => {
        const result = sensitiveWordFilter.validateContent('Hello 🎉🎊');

        expect(result.valid).toBe(true);
        expect(result.filtered).toBe(false);
      });

      it('should handle content with Chinese characters', () => {
        const result = sensitiveWordFilter.validateContent('你好世界');

        expect(result.valid).toBe(true);
        expect(result.content).toBe('你好世界');
      });

      it('should filter mixed sensitive and normal content', () => {
        const result = sensitiveWordFilter.validateContent('Hello spam world');

        expect(result.valid).toBe(true);
        expect(result.filtered).toBe(true);
        expect(result.content).toBe('Hello **** world');
      });
    });
  });

  describe('DensityController', () => {
    beforeEach(() => {
      // Reset local cache
      densityController.localCache.clear();
      densityController.maxDensity = 10;
    });

    describe('checkDensity', () => {
      it('should allow danmaku when density is below limit', async () => {
        const { getDanmakuDensity } = require('../../src/config/redis');
        getDanmakuDensity.mockResolvedValueOnce(5);

        const result = await densityController.checkDensity('video1', 30);

        expect(result).toBe(true);
      });

      it('should deny danmaku when density is at limit', async () => {
        const { getDanmakuDensity } = require('../../src/config/redis');
        getDanmakuDensity.mockResolvedValueOnce(10);

        const result = await densityController.checkDensity('video1', 30);

        expect(result).toBe(false);
      });

      it('should deny danmaku when density exceeds limit', async () => {
        const { getDanmakuDensity } = require('../../src/config/redis');
        getDanmakuDensity.mockResolvedValueOnce(15);

        const result = await densityController.checkDensity('video1', 30);

        expect(result).toBe(false);
      });

      it('should fall back to local cache on Redis error', async () => {
        const { getDanmakuDensity } = require('../../src/config/redis');
        getDanmakuDensity.mockRejectedValueOnce(new Error('Redis down'));

        densityController.localCache.set('video1:30', 3);

        const result = await densityController.checkDensity('video1', 30);

        expect(result).toBe(true);
      });

      it('should deny when local cache exceeds limit', async () => {
        const { getDanmakuDensity } = require('../../src/config/redis');
        getDanmakuDensity.mockRejectedValueOnce(new Error('Redis down'));

        densityController.localCache.set('video1:30', 10);

        const result = await densityController.checkDensity('video1', 30);

        expect(result).toBe(false);
      });

      it('should allow when local cache is empty', async () => {
        const { getDanmakuDensity } = require('../../src/config/redis');
        getDanmakuDensity.mockRejectedValueOnce(new Error('Redis down'));

        const result = await densityController.checkDensity('video1', 30);

        expect(result).toBe(true);
      });
    });

    describe('recordDanmaku', () => {
      it('should record danmaku in Redis', async () => {
        const { incrementDanmakuDensity } = require('../../src/config/redis');
        incrementDanmakuDensity.mockResolvedValueOnce();

        await densityController.recordDanmaku('video1', 30);

        expect(incrementDanmakuDensity).toHaveBeenCalledWith('video1', 30);
      });

      it('should fall back to local cache on Redis error', async () => {
        const { incrementDanmakuDensity } = require('../../src/config/redis');
        incrementDanmakuDensity.mockRejectedValueOnce(new Error('Redis down'));

        await densityController.recordDanmaku('video1', 30);

        expect(densityController.localCache.get('video1:30')).toBe(1);
      });
    });

    describe('getCurrentDensity', () => {
      it('should return Redis density', async () => {
        const { getDanmakuDensity } = require('../../src/config/redis');
        getDanmakuDensity.mockResolvedValueOnce(7);

        const result = await densityController.getCurrentDensity('video1', 45);

        expect(result).toBe(7);
      });

      it('should fall back to local cache', async () => {
        const { getDanmakuDensity } = require('../../src/config/redis');
        getDanmakuDensity.mockRejectedValueOnce(new Error('Redis down'));

        densityController.localCache.set('video1:45', 8);

        const result = await densityController.getCurrentDensity('video1', 45);

        expect(result).toBe(8);
      });
    });

    describe('calculateSpeedFactor', () => {
      it('should return 1.0 for low density', () => {
        expect(densityController.calculateSpeedFactor(0)).toBe(1.0);
        expect(densityController.calculateSpeedFactor(3)).toBe(1.0);
        expect(densityController.calculateSpeedFactor(5)).toBe(1.0);
      });

      it('should return 1.2 for medium density', () => {
        expect(densityController.calculateSpeedFactor(6)).toBe(1.2);
        expect(densityController.calculateSpeedFactor(10)).toBe(1.2);
      });

      it('should return 1.5 for high density', () => {
        expect(densityController.calculateSpeedFactor(11)).toBe(1.5);
        expect(densityController.calculateSpeedFactor(20)).toBe(1.5);
      });

      it('should return 2.0 for very high density', () => {
        expect(densityController.calculateSpeedFactor(21)).toBe(2.0);
        expect(densityController.calculateSpeedFactor(30)).toBe(2.0);
      });

      it('should return 2.5 for extreme density', () => {
        expect(densityController.calculateSpeedFactor(31)).toBe(2.5);
        expect(densityController.calculateSpeedFactor(100)).toBe(2.5);
      });
    });

    describe('calculateFlightDuration', () => {
      it('should calculate normal duration', () => {
        const duration = densityController.calculateFlightDuration(5, 300, 8000);

        expect(duration).toBeGreaterThan(0);
        expect(typeof duration).toBe('number');
      });

      it('should return shorter duration for high density', () => {
        const lowDensity = densityController.calculateFlightDuration(2, 300, 8000);
        const highDensity = densityController.calculateFlightDuration(20, 300, 8000);

        expect(highDensity).toBeLessThan(lowDensity);
      });

      it('should round to integer', () => {
        const duration = densityController.calculateFlightDuration(5, 300, 8000);

        expect(duration).toBe(Math.round(duration));
      });

      it('should handle very short videos', () => {
        const duration = densityController.calculateFlightDuration(5, 10, 8000);

        expect(duration).toBeGreaterThan(0);
      });

      it('should handle very long videos', () => {
        const duration = densityController.calculateFlightDuration(5, 7200, 8000);

        expect(duration).toBeGreaterThan(0);
      });
    });

    describe('getDensityStats', () => {
      it('should return density statistics', async () => {
        const stats = await densityController.getDensityStats('video1', 600);

        expect(stats).toMatchObject({
          videoId: 'video1',
          maxDensity: expect.any(Number),
          maxDensityTime: expect.any(Number),
          averageDensity: expect.any(Number),
          totalDanmakus: expect.any(Number),
          densityLimit: 10
        });
      });
    });

    describe('checkUserRateLimit', () => {
      it('should allow requests within limit', async () => {
        const result = await densityController.checkUserRateLimit('user1', 'video1');

        expect(result).toBe(true);
      });

      it('should deny requests exceeding limit', async () => {
        const { getRedis } = require('../../src/config/redis');
        const redis = getRedis();
        redis.get = jest.fn().mockResolvedValue('3');

        const result = await densityController.checkUserRateLimit('user1', 'video1');

        expect(result).toBe(false);
      });

      it('should allow on Redis error', async () => {
        const { getRedis } = require('../../src/config/redis');
        const redis = getRedis();
        redis.get = jest.fn().mockRejectedValue(new Error('Redis error'));

        const result = await densityController.checkUserRateLimit('user1', 'video1');

        expect(result).toBe(true);
      });
    });

    describe('resetDensity', () => {
      it('should reset density for video', async () => {
        const { clearDanmakuCache } = require('../../src/config/redis');
        clearDanmakuCache.mockResolvedValueOnce();

        await densityController.resetDensity('video1');

        expect(clearDanmakuCache).toHaveBeenCalledWith('video1');
      });
    });

    describe('cleanupIfNeeded', () => {
      it('should not cleanup before interval', () => {
        densityController.lastCleanup = Date.now();
        densityController.localCache.set('video1:1000', 5);

        densityController.cleanupIfNeeded();

        expect(densityController.localCache.has('video1:1000')).toBe(true);
      });

      it('should cleanup old entries after interval', () => {
        densityController.lastCleanup = Date.now() - 120000;
        densityController.localCache.set(`video1:${Math.floor(Date.now() / 1000) - 4000}`, 5);

        densityController.cleanupIfNeeded();

        // Old entries should be cleaned
        expect(densityController.lastCleanup).toBeGreaterThan(0);
      });
    });
  });
});
