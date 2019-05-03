'use strict';
module.exports = {
  up: function(queryInterface, Sequelize) {
    // NOTE: we are dropping the post_attachments table completely - there is no meaningful data in the table
    return queryInterface.dropTable('post_attachments').then((results)=>{
        return queryInterface.createTable('post_attachments', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.BIGINT
        },
        postId: {
            type: Sequelize.BIGINT
        },
        originalFileName: {
            allowNull: false,
            type: Sequelize.STRING(512)
        },
        url: {
            allowNull: false,
            type: Sequelize.STRING
        },
        createdBy: {
            allowNull: false,
            type: Sequelize.STRING
        },
        updatedBy: {
            allowNull: false,
            type: Sequelize.STRING
        },
        deletedBy: {
            type: Sequelize.STRING
        },
        createdAt: {
            allowNull: false,
            type: Sequelize.DATE
        },
        deletedAt: {
            type: Sequelize.DATE
        },
        updatedAt: {
            allowNull: false,
            type: Sequelize.DATE
        }
        });
    });
  },
  down: function(queryInterface, Sequelize) {
    return queryInterface.dropTable('post_attachments');
  }
};
