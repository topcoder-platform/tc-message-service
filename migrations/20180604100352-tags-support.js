'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    queryInterface.addColumn(
      'topics',
      'tags',
      {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
      }
    ).then(() => queryInterface.sequelize.query('UPDATE topics SET tags = ARRAY[tag] WHERE tag IS NOT NULL;'))
  },

  down: (queryInterface, Sequelize) => {
    queryInterface.removeColumn('topics', 'tags')
  }
};
