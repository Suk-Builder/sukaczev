// Test setup
const config = require('../src/config');

config.app.env = 'test';
config.app.port = 0;

jest.setTimeout(30000);

// Mock logger
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Global test fixtures
const mockNotificationData = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  userId: '550e8400-e29b-41d4-a716-446655440001',
  type: 'video_like',
  senderId: '550e8400-e29b-41d4-a716-446655440002',
  resourceId: '550e8400-e29b-41d4-a716-446655440003',
  resourceType: 'video',
  content: 'Someone liked your video',
  isRead: false,
  metadata: {
    videoTitle: 'Test Video',
    senderName: 'TestUser',
  },
  aggregatedCount: 1,
  aggregatedIds: [],
};

const mockNotificationsData = [
  mockNotificationData,
  {
    id: '550e8400-e29b-41d4-a716-446655440010',
    userId: '550e8400-e29b-41d4-a716-446655440001',
    type: 'comment_reply',
    senderId: '550e8400-e29b-41d4-a716-446655440004',
    resourceId: '550e8400-e29b-41d4-a716-446655440005',
    resourceType: 'comment',
    content: 'Someone replied to your comment',
    isRead: false,
    metadata: { videoTitle: 'Another Video' },
    aggregatedCount: 1,
    aggregatedIds: [],
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440020',
    userId: '550e8400-e29b-41d4-a716-446655440001',
    type: 'new_follower',
    senderId: '550e8400-e29b-41d4-a716-446655440006',
    resourceId: '550e8400-e29b-41d4-a716-446655440006',
    resourceType: 'user',
    content: 'Someone started following you',
    isRead: true,
    readAt: new Date(),
    metadata: { followerName: 'NewFollower' },
    aggregatedCount: 1,
    aggregatedIds: [],
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440030',
    userId: '550e8400-e29b-41d4-a716-446655440001',
    type: 'system',
    senderId: null,
    resourceId: null,
    resourceType: 'system',
    content: 'System maintenance scheduled for tomorrow',
    isRead: false,
    metadata: { title: 'Maintenance Notice' },
    aggregatedCount: 1,
    aggregatedIds: [],
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440040',
    userId: '550e8400-e29b-41d4-a716-446655440001',
    type: 'coin_received',
    senderId: '550e8400-e29b-41d4-a716-446655440007',
    resourceId: '550e8400-e29b-41d4-a716-446655440008',
    resourceType: 'video',
    content: 'You received 2 coins',
    isRead: false,
    metadata: { coinAmount: 2, videoTitle: 'Great Video' },
    aggregatedCount: 1,
    aggregatedIds: [],
  },
];

module.exports = {
  mockNotificationData,
  mockNotificationsData,
};
