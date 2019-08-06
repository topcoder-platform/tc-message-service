module.exports = {
  EVENT: {
    TOPIC_CREATED: 'topic.created',
    TOPIC_UPDATED: 'topic.updated',
    TOPIC_DELETED: 'topic.deleted',
    POST_CREATED: 'post.created',
    POST_UPDATED: 'post.edited',
    POST_DELETED: 'post.deleted',
  },
  USER_ROLE: {
    TOPCODER_ADMIN: 'administrator',
    CONNECT_ADMIN: 'Connect Admin',
    MANAGER: 'Connect Manager',
    COPILOT: 'Connect Copilot',
  },

  REFERENCE_LOOKUPS: {
    PROJECT: 'project',
  },

  BUS_API_EVENT: {
    TOPIC_CREATED: 'connect.notification.project.topic.created',
    TOPIC_UPDATED: 'connect.notification.project.topic.updated',
    TOPIC_DELETED: 'connect.notification.project.topic.deleted',
    POST_CREATED: 'connect.notification.project.post.created',
    POST_UPDATED: 'connect.notification.project.post.edited',
    POST_DELETED: 'connect.notification.project.post.deleted',
  },

  DISCOURSE_WEBHOOK_STATUS: {
    PENDING: 'pending',
    COMPLETED: 'completed',
    ERROR: 'error',
  },

  TOKEN_SCOPES: {
    CONNECT_PROJECT_ADMIN: 'all:connect_project',
  },
};
