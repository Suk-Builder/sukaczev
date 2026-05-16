// Test setup - run before all tests
const config = require('../src/config');

// Set test environment
config.app.env = 'test';
config.app.port = 0; // Random port

// Mock external connections in test environment
jest.setTimeout(30000);

// Global test fixtures
const mockVideoData = {
  id: 'vid-001',
  title: '测试视频标题 Test Video Title',
  description: '这是一个测试视频描述 This is a test video description',
  userId: 'user-001',
  username: '测试UP主',
  category: 'tech',
  tags: ['test', 'video', '科技'],
  views: 1000,
  likes: 100,
  duration: 300,
  coverUrl: 'https://example.com/cover.jpg',
  videoUrl: 'https://example.com/video.mp4',
  createdAt: '2024-01-15T08:00:00.000Z',
  updatedAt: '2024-01-15T08:00:00.000Z',
};

const mockVideosData = [
  mockVideoData,
  {
    id: 'vid-002',
    title: '动漫推荐 Anime Recommendations',
    description: 'Best anime of 2024 年度动漫推荐',
    userId: 'user-002',
    username: 'AnimeChannel',
    category: 'anime',
    tags: ['anime', '推荐', '2024'],
    views: 5000,
    likes: 500,
    duration: 600,
    coverUrl: 'https://example.com/cover2.jpg',
    videoUrl: 'https://example.com/video2.mp4',
    createdAt: '2024-02-01T10:00:00.000Z',
    updatedAt: '2024-02-01T10:00:00.000Z',
  },
  {
    id: 'vid-003',
    title: '美食制作教程 Food Tutorial',
    description: 'Learn to cook delicious food 学习制作美食',
    userId: 'user-003',
    username: 'ChefWang',
    category: 'food',
    tags: ['food', 'cooking', '美食'],
    views: 3000,
    likes: 300,
    duration: 900,
    coverUrl: 'https://example.com/cover3.jpg',
    videoUrl: 'https://example.com/video3.mp4',
    createdAt: '2024-03-01T12:00:00.000Z',
    updatedAt: '2024-03-01T12:00:00.000Z',
  },
  {
    id: 'vid-004',
    title: 'Python Programming Tutorial',
    description: 'Learn Python from scratch 从零学Python',
    userId: 'user-001',
    username: '测试UP主',
    category: 'education',
    tags: ['python', 'programming', '教育'],
    views: 8000,
    likes: 800,
    duration: 1800,
    coverUrl: 'https://example.com/cover4.jpg',
    videoUrl: 'https://example.com/video4.mp4',
    createdAt: '2024-03-15T14:00:00.000Z',
    updatedAt: '2024-03-15T14:00:00.000Z',
  },
  {
    id: 'vid-005',
    title: '健身训练指南 Fitness Guide',
    description: 'Daily workout routine 每日健身计划',
    userId: 'user-004',
    username: 'FitnessPro',
    category: 'sports',
    tags: ['fitness', 'workout', '健身'],
    views: 2000,
    likes: 200,
    duration: 1200,
    coverUrl: 'https://example.com/cover5.jpg',
    videoUrl: 'https://example.com/video5.mp4',
    createdAt: '2024-04-01T16:00:00.000Z',
    updatedAt: '2024-04-01T16:00:00.000Z',
  },
];

module.exports = {
  mockVideoData,
  mockVideosData,
};
