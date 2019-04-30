'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    // add column
    queryInterface.addColumn(
      'reference_lookups',
      'accessCondition',
      {
        type: Sequelize.STRING,
        allowNull: true,
      }
    )
      // set access condition for project references
      .then(() => queryInterface.sequelize.query(`UPDATE reference_lookups SET "accessCondition" = 'members contains ''{"userId":{userId}}''' WHERE "reference"='project';`))
      // set access condition `1 == 1` which is always true for other references
      .then(() => queryInterface.sequelize.query(`UPDATE reference_lookups SET "accessCondition" = '1 == 1' WHERE "reference"<>'project';`))
      // don't allow null for column
      .then(() => queryInterface.changeColumn(
        'reference_lookups',
        'accessCondition',
        {
          type: Sequelize.STRING,
          allowNull: false,
        }
      ))
  },

  down: (queryInterface, Sequelize) => {
    queryInterface.removeColumn('reference_lookups', 'accessCondition')
  }
};
