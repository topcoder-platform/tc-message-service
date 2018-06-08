'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    queryInterface.addColumn(
      'topics',
      'tags',
      {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: false,
      }
    ),
    queryInterface.removeColumn('topics', 'tag')
  },

  down: (queryInterface, Sequelize) => {
    queryInterface.removeColumn('topics', 'tag'),
    queryInterface.removeColumn('topics', 'tags')
  }
};
