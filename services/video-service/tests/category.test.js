/**
 * @fileoverview Category tests - Category CRUD and tree structure tests.
 */

const request = require('supertest');
const { app } = require('../src/app');
const Category = require('../src/models/Category');
const redis = require('../src/config/redis');
const {
  setupTestDatabase,
  cleanupTestData,
  cleanupRedis,
  generateTestToken,
  getAuthHeaders,
  mockRabbitMQ,
  restoreRabbitMQ,
  wait,
} = require('./setup');

describe('Category Endpoints', () => {
  let authToken;

  beforeAll(async () => {
    await setupTestDatabase();
    await mockRabbitMQ();
    authToken = generateTestToken('test-user-id');
  });

  beforeEach(async () => {
    await cleanupRedis();
  });

  afterAll(async () => {
    await cleanupTestData();
    await cleanupRedis();
    restoreRabbitMQ();
  });

  // ============================================================
  // GET /api/categories
  // ============================================================

  describe('GET /api/categories', () => {
    test('should list all categories in tree structure', async () => {
      const res = await request(app).get('/api/categories');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.categories).toBeDefined();
      expect(Array.isArray(res.body.data.categories)).toBe(true);
      expect(res.body.data.categories.length).toBeGreaterThan(0);
    });

    test('should have root categories without parent_id', async () => {
      const res = await request(app).get('/api/categories');

      const categories = res.body.data.categories;
      categories.forEach((cat) => {
        expect(cat.parent_id).toBeNull();
      });
    });

    test('should have children array for root categories', async () => {
      const res = await request(app).get('/api/categories');

      const categories = res.body.data.categories;
      categories.forEach((cat) => {
        expect(Array.isArray(cat.children)).toBe(true);
      });
    });

    test('should include expected top-level categories', async () => {
      const res = await request(app).get('/api/categories');

      const slugs = res.body.data.categories.map((c) => c.slug);
      expect(slugs).toContain('anime');
      expect(slugs).toContain('music');
      expect(slugs).toContain('tech');
      expect(slugs).toContain('knowledge');
      expect(slugs).toContain('life');
      expect(slugs).toContain('game');
    });

    test('subcategories should have correct parent_id', async () => {
      const res = await request(app).get('/api/categories');

      const animeCategory = res.body.data.categories.find((c) => c.slug === 'anime');
      if (animeCategory && animeCategory.children.length > 0) {
        animeCategory.children.forEach((child) => {
          expect(child.parent_id).toBe(animeCategory.id);
        });
      }
    });

    test('should cache category tree', async () => {
      await request(app).get('/api/categories');
      await wait(100);

      const cached = await redis.getCategoryCache();
      expect(cached).toBeDefined();
      expect(Array.isArray(cached)).toBe(true);
    });

    test('should return cached data on second request', async () => {
      const res1 = await request(app).get('/api/categories');
      await wait(100);

      const res2 = await request(app).get('/api/categories');

      expect(res1.body.data.categories.length).toBe(res2.body.data.categories.length);
    });

    test('categories should have required fields', async () => {
      const res = await request(app).get('/api/categories');

      const checkFields = (cat) => {
        expect(cat.id).toBeDefined();
        expect(cat.name).toBeDefined();
        expect(cat.slug).toBeDefined();
        expect(cat.icon).toBeDefined();
        expect(cat.sort_order).toBeDefined();
      };

      res.body.data.categories.forEach((cat) => {
        checkFields(cat);
        cat.children.forEach((child) => checkFields(child));
      });
    });
  });

  // ============================================================
  // GET /api/categories/:id
  // ============================================================

  describe('GET /api/categories/:id', () => {
    test('should get category by ID', async () => {
      const categories = await Category.getAll();
      const firstCategory = categories[0];

      const res = await request(app).get(`/api/categories/${firstCategory.id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.category.id).toBe(firstCategory.id);
      expect(res.body.data.category.name).toBe(firstCategory.name);
    });

    test('should include subcategories', async () => {
      const categories = await Category.getAll();
      const rootCategory = categories.find((c) => c.parent_id === null);

      const res = await request(app).get(`/api/categories/${rootCategory.id}`);

      expect(res.body.data.category.children).toBeDefined();
      expect(Array.isArray(res.body.data.category.children)).toBe(true);
    });

    test('should return 404 for non-existent ID', async () => {
      const res = await request(app).get('/api/categories/99999');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('CATEGORY_NOT_FOUND');
    });

    test('should reject invalid ID format', async () => {
      const res = await request(app).get('/api/categories/not-a-number');

      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // POST /api/categories
  // ============================================================

  describe('POST /api/categories', () => {
    test('should create a new category', async () => {
      const res = await request(app)
        .post('/api/categories')
        .set(getAuthHeaders(authToken))
        .send({
          name: 'Test Category',
          slug: 'test-category',
          icon: 'test',
          sortOrder: 99,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.category.name).toBe('Test Category');
      expect(res.body.data.category.slug).toBe('test-category');
    });

    test('should create subcategory with parent', async () => {
      const parents = await Category.getAll();
      const parent = parents.find((c) => c.parent_id === null);

      const res = await request(app)
        .post('/api/categories')
        .set(getAuthHeaders(authToken))
        .send({
          name: 'Test Subcategory',
          slug: 'test-sub',
          icon: 'sub',
          parentId: parent.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.category.parent_id).toBe(parent.id);
    });

    test('should reject duplicate slug', async () => {
      await request(app)
        .post('/api/categories')
        .set(getAuthHeaders(authToken))
        .send({
          name: 'First',
          slug: 'dup-slug-test',
        });

      const res = await request(app)
        .post('/api/categories')
        .set(getAuthHeaders(authToken))
        .send({
          name: 'Second',
          slug: 'dup-slug-test',
        });

      expect(res.status).toBe(409);
    });

    test('should reject missing name', async () => {
      const res = await request(app)
        .post('/api/categories')
        .set(getAuthHeaders(authToken))
        .send({ slug: 'no-name' });

      expect(res.status).toBe(400);
    });

    test('should reject missing slug', async () => {
      const res = await request(app)
        .post('/api/categories')
        .set(getAuthHeaders(authToken))
        .send({ name: 'No Slug' });

      expect(res.status).toBe(400);
    });

    test('should reject invalid slug characters', async () => {
      const res = await request(app)
        .post('/api/categories')
        .set(getAuthHeaders(authToken))
        .send({
          name: 'Bad Slug',
          slug: 'Invalid_Slug!@#',
        });

      expect(res.status).toBe(400);
    });

    test('should require authentication', async () => {
      const res = await request(app)
        .post('/api/categories')
        .send({
          name: 'No Auth',
          slug: 'no-auth',
        });

      expect(res.status).toBe(401);
    });
  });

  // ============================================================
  // PUT /api/categories/:id
  // ============================================================

  describe('PUT /api/categories/:id', () => {
    test('should update category name', async () => {
      const categories = await Category.getAll();
      const category = categories[0];

      const res = await request(app)
        .put(`/api/categories/${category.id}`)
        .set(getAuthHeaders(authToken))
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.data.category.name).toBe('Updated Name');
    });

    test('should update category icon', async () => {
      const categories = await Category.getAll();
      const category = categories[0];

      const res = await request(app)
        .put(`/api/categories/${category.id}`)
        .set(getAuthHeaders(authToken))
        .send({ icon: 'new-icon' });

      expect(res.status).toBe(200);
      expect(res.body.data.category.icon).toBe('new-icon');
    });

    test('should update sort order', async () => {
      const categories = await Category.getAll();
      const category = categories[0];

      const res = await request(app)
        .put(`/api/categories/${category.id}`)
        .set(getAuthHeaders(authToken))
        .send({ sortOrder: 5 });

      expect(res.status).toBe(200);
      expect(res.body.data.category.sort_order).toBe(5);
    });

    test('should return 404 for non-existent category', async () => {
      const res = await request(app)
        .put('/api/categories/99999')
        .set(getAuthHeaders(authToken))
        .send({ name: 'Ghost' });

      expect(res.status).toBe(404);
    });

    test('should require authentication', async () => {
      const categories = await Category.getAll();

      const res = await request(app)
        .put(`/api/categories/${categories[0].id}`)
        .send({ name: 'No Auth' });

      expect(res.status).toBe(401);
    });
  });

  // ============================================================
  // DELETE /api/categories/:id
  // ============================================================

  describe('DELETE /api/categories/:id', () => {
    test('should delete a category', async () => {
      const category = await Category.create({
        name: 'To Delete',
        slug: 'to-delete-test',
      });

      const res = await request(app)
        .delete(`/api/categories/${category.id}`)
        .set(getAuthHeaders(authToken));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('should return 404 for non-existent category', async () => {
      const res = await request(app)
        .delete('/api/categories/99999')
        .set(getAuthHeaders(authToken));

      expect(res.status).toBe(404);
    });

    test('should require authentication', async () => {
      const res = await request(app)
        .delete('/api/categories/1');

      expect(res.status).toBe(401);
    });
  });

  // ============================================================
  // Category Tree Structure Tests
  // ============================================================

  describe('Category Tree Structure', () => {
    test('anime category should have subcategories', async () => {
      const res = await request(app).get('/api/categories');

      const anime = res.body.data.categories.find((c) => c.slug === 'anime');
      expect(anime).toBeDefined();
      expect(anime.children.length).toBeGreaterThan(0);
    });

    test('music category should have subcategories', async () => {
      const res = await request(app).get('/api/categories');

      const music = res.body.data.categories.find((c) => c.slug === 'music');
      expect(music).toBeDefined();
      expect(music.children.length).toBeGreaterThan(0);
    });

    test('tech category should have subcategories', async () => {
      const res = await request(app).get('/api/categories');

      const tech = res.body.data.categories.find((c) => c.slug === 'tech');
      expect(tech).toBeDefined();
      expect(tech.children.length).toBeGreaterThan(0);
    });

    test('subcategories should have correct structure', async () => {
      const res = await request(app).get('/api/categories');

      res.body.data.categories.forEach((parent) => {
        parent.children.forEach((child) => {
          expect(child.id).toBeDefined();
          expect(child.name).toBeDefined();
          expect(child.slug).toBeDefined();
          expect(child.icon).toBeDefined();
          expect(child.parent_id).toBe(parent.id);
          expect(child.children).toBeUndefined(); // Only 2 levels
        });
      });
    });

    test('should find category by slug', async () => {
      const category = await Category.findBySlug('anime');
      expect(category).toBeDefined();
      expect(category.name).toBe('动画');
    });

    test('should return null for non-existent slug', async () => {
      const category = await Category.findBySlug('non-existent-slug-12345');
      expect(category).toBeNull();
    });

    test('should get category with subcategories', async () => {
      const anime = await Category.findBySlug('anime');
      const withSubs = await Category.getWithSubcategories(anime.id);

      expect(withSubs).toBeDefined();
      expect(withSubs.children).toBeDefined();
      expect(withSubs.children.length).toBeGreaterThan(0);
    });

    test('tree should have correct depth', async () => {
      const tree = await Category.getCategoryTree();

      tree.forEach((root) => {
        expect(root.parent_id).toBeNull();
        root.children.forEach((child) => {
          expect(child.parent_id).toBe(root.id);
        });
      });
    });
  });

  // ============================================================
  // Category Model Direct Tests
  // ============================================================

  describe('Category Model', () => {
    test('should create category', async () => {
      const category = await Category.create({
        name: 'Model Test',
        slug: 'model-test',
      });

      expect(category.id).toBeDefined();
      expect(category.name).toBe('Model Test');
    });

    test('should find by ID', async () => {
      const created = await Category.create({
        name: 'Find Test',
        slug: 'find-test',
      });

      const found = await Category.findById(created.id);
      expect(found).not.toBeNull();
      expect(found.id).toBe(created.id);
    });

    test('should update category', async () => {
      const created = await Category.create({
        name: 'Update Test',
        slug: 'update-test',
      });

      const updated = await Category.update(created.id, { name: 'Updated' });
      expect(updated.name).toBe('Updated');
    });

    test('should delete category', async () => {
      const created = await Category.create({
        name: 'Delete Test',
        slug: 'delete-test',
      });

      const result = await Category.remove(created.id);
      expect(result).toBe(true);

      const found = await Category.findById(created.id);
      expect(found).toBeNull();
    });

    test('should get all categories', async () => {
      const categories = await Category.getAll();
      expect(categories.length).toBeGreaterThan(0);
    });

    test('should get subcategories', async () => {
      const anime = await Category.findBySlug('anime');
      const subs = await Category.getSubcategories(anime.id);
      expect(subs.length).toBeGreaterThan(0);
    });

    test('should get video count', async () => {
      const categories = await Category.getAll();
      const count = await Category.getVideoCount(categories[0].id);
      expect(typeof count).toBe('number');
    });
  });
});
