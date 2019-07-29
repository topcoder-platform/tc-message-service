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
    TOPIC_CREATED: 'connect.notifications.project.topic.created',
    TOPIC_UPDATED: 'connect.notifications.project.topic.updated',
    TOPIC_DELETED: 'connect.notifications.project.topic.deleted',
    POST_CREATED: 'connect.notifications.project.post.created',
    POST_UPDATED: 'connect.notifications.project.post.edited',
    POST_DELETED: 'connect.notifications.project.post.deleted',
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
