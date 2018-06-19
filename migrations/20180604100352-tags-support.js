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
    .then(() => queryInterface.removeColumn('topics', 'tag'))
  },

  down: (queryInterface, Sequelize) => {
    // queryInterface.removeColumn('topics', 'tags')
    queryInterface.addColumn('topics', 'tag',
      {
        type: Sequelize.STRING,
        allowNull: true,
      }).then(() => queryInterface.sequelize.query('UPDATE topics SET tag = tags[1] WHERE tags IS NOT NULL;'))
      .then(() => queryInterface.removeColumn('topics', 'tags'))
  }
};
