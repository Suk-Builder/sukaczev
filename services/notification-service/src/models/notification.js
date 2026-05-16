const { DataTypes, Model } = require('sequelize');
const { getSequelize } = require('../config/database');

const NOTIFICATION_TYPES = [
  'comment_reply',
  'video_like',
  'new_follower',
  'system',
  'coin_received',
];

const RESOURCE_TYPES = ['video', 'comment', 'user', 'system'];

class Notification extends Model {
  /**
   * Mark notification as read
   */
  async markAsRead() {
    if (this.isRead) return this;
    this.isRead = true;
    this.readAt = new Date();
    await this.save();
    return this;
  }

  /**
   * Get formatted notification data
   */
  toJSON() {
    const values = super.toJSON();
    return {
      id: values.id,
      userId: values.user_id,
      type: values.type,
      senderId: values.sender_id,
      resourceId: values.resource_id,
      resourceType: values.resource_type,
      content: values.content,
      isRead: values.is_read,
      readAt: values.read_at,
      metadata: values.metadata,
      createdAt: values.created_at,
      updatedAt: values.updated_at,
    };
  }
}

const defineNotificationModel = () => {
  const sequelize = getSequelize();

  Notification.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'user_id',
        references: null,
      },
      type: {
        type: DataTypes.ENUM(...NOTIFICATION_TYPES),
        allowNull: false,
      },
      senderId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'sender_id',
        comment: 'NULL for system notifications',
      },
      resourceId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'resource_id',
      },
      resourceType: {
        type: DataTypes.ENUM(...RESOURCE_TYPES),
        allowNull: true,
        field: 'resource_type',
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      isRead: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_read',
      },
      readAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'read_at',
      },
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
        allowNull: true,
      },
      aggregatedCount: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        field: 'aggregated_count',
        comment: 'Number of aggregated notifications',
      },
      aggregatedIds: {
        type: DataTypes.JSONB,
        defaultValue: [],
        field: 'aggregated_ids',
        comment: 'IDs of aggregated notifications',
      },
    },
    {
      sequelize,
      modelName: 'Notification',
      tableName: 'notifications',
      timestamps: true,
      underscored: true,
      indexes: [
        {
          fields: ['user_id', 'created_at'],
          name: 'idx_notifications_user_created',
        },
        {
          fields: ['user_id', 'is_read'],
          name: 'idx_notifications_user_read',
        },
        {
          fields: ['user_id', 'type'],
          name: 'idx_notifications_user_type',
        },
        {
          fields: ['resource_id', 'resource_type', 'user_id'],
          name: 'idx_notifications_resource',
        },
        {
          fields: ['created_at'],
          name: 'idx_notifications_created',
          using: 'BRIN',
        },
      ],
      hooks: {
        afterCreate: (notification) => {
          // Emit event for WebSocket push
          if (global.notificationEmitter) {
            global.notificationEmitter.emit('new', notification);
          }
        },
      },
    }
  );

  return Notification;
};

module.exports = {
  Notification,
  defineNotificationModel,
  NOTIFICATION_TYPES,
  RESOURCE_TYPES,
};
