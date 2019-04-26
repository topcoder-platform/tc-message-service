'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    queryInterface.addColumn(
      'reference_lookups',
      'accessCondition',
      {
        type: Sequelize.STRING,
        allowNull: true,
      }
    )
      .then(() => queryInterface.sequelize.query(`UPDATE reference_lookups SET "accessCondition" = 'members contains ''{"userId":{userId}}''' WHERE "reference"='project';`))
  },

  down: (queryInterface, Sequelize) => {
    queryInterface.removeColumn('reference_lookups', 'accessCondition')
  }
};
