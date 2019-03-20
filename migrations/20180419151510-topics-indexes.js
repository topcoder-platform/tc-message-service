'use strict';
module.exports = {
  up: function(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.addIndex('topics', { fields: ['reference', 'referenceId'], name: 'reference_idx', unique: false}),
    ]);
  },
  down: function(queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeIndex('topics', 'reference_idx'),
    ]);
  }
};