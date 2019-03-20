'use strict';
module.exports = {
  up: function(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.addIndex('posts', { fields: ['topicId'], name: 'topicId_idx', unique: false}),
    ]);
  },
  down: function(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeIndex('posts', 'topicId_idx'),
    ]);
  }
};