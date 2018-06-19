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
    ),
    queryInterface.sequelize.query(
        'UPDATE topics SET tags = ARRAY[tag];'
      ),
    queryInterface.removeColumn('topics', 'tag')
  },

  down: (queryInterface, Sequelize) => {
    queryInterface.addColumn('topics', 'tag',
      {
        type: Sequelize.STRING,
        allowNull: true,
      }),
    queryInterface.sequelize.query(
        'UPDATE topics SET tag = ARRAY[tags[0]];'
      ),
    queryInterface.removeColumn('topics', 'tags')
  }
};
