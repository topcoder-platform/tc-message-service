'user strict';

/**
 * Represents an incoming email
 * @param  {Object} Sequelize sequelize object
 * @param  {Object} DataTypes sequelize data types
 * @return {void}
 */
module.exports = (Sequelize, DataTypes) => {
  const EmailLog = Sequelize.define('email_logs', {
    // The primary key
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    // The from email address
    fromAddress: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // The to email address
    toAddress: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    // The cc email addresses, seperated by comma
    ccAddresses: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // The email subject
    subject: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // When was this record created
    createdAt: {
      type: DataTypes.DATE,
    },
    // When was this record last updated
    updatedAt: {
      type: DataTypes.DATE,
    },
    // The email body
    rawText: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // The user id
    userId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // The topic id
    topicId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // The post id
    postId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // The token
    token: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    // The status
    status: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  });
  return EmailLog;
};
