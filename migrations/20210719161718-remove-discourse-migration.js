'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return [
      queryInterface.removeColumn('topics', 'discourseTopicId'),
      queryInterface.removeColumn('posts', 'discoursePostId'),
    ]
  },

  down: function (queryInterface, Sequelize) {
    return [
      queryInterface.addColumn(
	'topics',
	'discourseTopicId',
	{
	  type: Sequelize.BIGINT,
	  allowNull: true,
	}
      ),
      queryInterface.addColumn(
	'posts',
	'discoursePostId',
	{
	  type: Sequelize.BIGINT,
	  allowNull: true,
	}
      ),
    ]
  }
};