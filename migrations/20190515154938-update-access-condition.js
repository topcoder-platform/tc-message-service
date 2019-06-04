'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    queryInterface.sequelize.query(`UPDATE reference_lookups SET "accessCondition" = '((!(tags contains ''MESSAGES'')) && (members contains (''{"userId":'' + userId + ''}''))) ` +
        `|| ((tags contains ''MESSAGES'') && (members contains (''{"userId":'' + userId + ''}'')) && (!(members contains (''{"userId":'' + userId + '',"role":"customer"}''))))' WHERE "reference"='project';`)
  },

  down: (queryInterface, Sequelize) => {
    queryInterface.sequelize.query(`UPDATE reference_lookups SET "accessCondition" = 'members contains ''{"userId":{userId}}''' WHERE "reference"='project';`)
  }
};