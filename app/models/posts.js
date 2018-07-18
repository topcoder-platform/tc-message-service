'user strict';

/**
 * Represents a post under a topic.
 */
/**
 * Represents a post under a topic.
 * @param  {Object} Sequelize sequelize object
 * @param  {Object} DataTypes sequelize data types
 * @return {void}
 */
module.exports = (Sequelize, DataTypes) => {
  // Posts
  const Post = Sequelize.define('posts', {
    // The primary key
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    // content of the post
    raw: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // discourse post id for mapping updates in posts via discourse webhook
    discoursePostId: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    // topic id
    topicId: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    postNumber: {
      type: DataTypes.INTEGER,
    },
    viaEmail: {
      type: DataTypes.BOOLEAN,
    },
    rawEmail: {
      type: DataTypes.STRING,
    },
    hidden: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    hiddenReason: {
      type: DataTypes.STRING,
    },
    // When was this record created
    createdAt: {
      type: DataTypes.DATE,
    },
    // Who created this record
    createdBy: {
      type: DataTypes.STRING,
    },
    // When was this record last updated
    updatedAt: {
      type: DataTypes.DATE,
    },
    // Who last updated this record
    updatedBy: {
      type: DataTypes.STRING,
    },
    // When was this record deleted
    deletedAt: {
      type: DataTypes.DATE,
    },
    // Who deleted this record
    deletedBy: {
      type: DataTypes.STRING,
    },
  },
    {
      freezeTableName: true,
    });

  Post.associate = (models) => {
    Post.hasMany(models.post_user_stats, { as: 'userStats', foreignKey: 'postId' });
  };

  /**
   * Creates a post in database with given post body and for given topic.
   *
   * @param {Object} models Sequelize database models
   * @param {String} postBody content for the post body
   * @param {Object} topic topic object for which post is to be created
   * @param {String} discoursePostId discourse post id
   * @param {String} reqUserId id of the user requesting the operation
   * @param {Object} transaction the transaction
   *
   * @return {Promise} promise resolving in a Sequelize object representig a post
   */
  Post.createPost = (models, postBody, topic, discoursePostId = null, reqUserId, transaction = null) => {
    const post = models.posts.build({
      topicId: topic.id,
      discoursePostId,
      raw: postBody,
      postNumber: topic.highestPostNumber + 1,
      viaEmail: false,
      hidden: false,
      createdBy: reqUserId,
      updatedBy: reqUserId,
    }, { transaction });
    return post.save();
  };

  /**
   * Fetches the total post count for the topic identified by the given id.
   *
   * @param {Number} topicId id of the topic for which post count is to be fetched
   * @param {Object} options containing addition options, currently supported are:
   * raw: boolean value to fetch the post in raw form i.e. without sequelize stuff
   * countDeleted: boolean value to count deleted post, helpful in admin operations
   *
   * @return {Promise} promise which resolves in array of Sequelize objects containing topic id and count of posts
   */
  Post.getTopicPostsCount = (topicId, { countDeleted = false } = { }) => {
    const where = { topicId };
    if (!countDeleted) {
      where.deletedAt = { [Sequelize.Op.eq]: null };
    }
    return Post.count({
      where,
    });
  };

  /**
   * Fetches the total post count for the topics identified by the given ids.
   *
   * @param {Array} topicIds array of ids of the topics for which post count are to be fetched
   * @param {Object} options containing addition options, currently supported are:
   * raw: boolean value to fetch the post in raw form i.e. without sequelize stuff
   * countDeleted: boolean value to count deleted post, helpful in admin operations
   *
   * @return {Promise} promise which resolves in array of Sequelize objects containing topic id and count of posts
   */
  Post.getPostsCount = (topicIds, { raw = true, countDeleted = false } = { }) => {
    const where = { topicId: { [Sequelize.Op.in]: topicIds } };
    if (!countDeleted) {
      where.deletedAt = { [Sequelize.Op.eq]: null };
    }
    return Post.findAll({
      where,
      raw,
      attributes: ['topicId', [Sequelize.fn('COUNT', Sequelize.col('id')), 'totalPosts']],
      group: ['topicId'],
    });
  };

  /**
   * Finds posts identified by the given filter params.
   *
   * @param {Object} models Sequelize database models
   * @param {Object} adapter adapter service which converts database model to logical model
   * @param {Object} filters object containing filter parameters, it supports all db fields of post object
   * @param {Object} options containing addition options, currently supported are:
   * fetchDeleted: boolean value to fetch deleted post, helpful in admin operations
   *
   * @return {Promise} promise which resolves to logical model of the found posts
   */
  Post.findPosts = (models, adapter, filters, { fetchDeleted = false } = {}) => {
    const where = filters;
    if (!fetchDeleted) {
      where.deletedAt = { [Sequelize.Op.eq]: null };
    }
    return Post.findAll({
      where,
    }).then((posts) => {
      if (!posts || posts.length === 0) return null;
      return adapter.adaptPosts(posts);
    });
  };

  /**
   * Finds a post identified by the given topic id and post id.
   *
   * @param {Object} models Sequelize database models
   * @param {Object} adapter adapter service which converts database model to logical model
   * @param {Object} filters object containing filter parameters, currently supported are:
   * topicId: id of the topic to be found
   * postId : id of post to be found
   * @param {Object} options containing addition options, currently supported are:
   * raw: boolean value to fetch the post in raw form i.e. without sequelize stuff
   * fetchDeleted: boolean value to fetch deleted post, helpful in admin operations
   *
   * @return {Promise} promise which resolves to logical model of the found post
   */
  Post.findPost = (models, adapter, { topicId, postId }, { raw, fetchDeleted = false } = { }) => {
    const where = { id: postId, topicId };
    if (!fetchDeleted) {
      where.deletedAt = { [Sequelize.Op.eq]: null };
    }
    return Post.findOne({
      where,
      raw,
    }).then((post) => {
      if (!post) return null;
      return raw ? post : adapter.adaptPost(post);
    });
  };

  /**
   * Updates the post identified by the given parameters.
   *
   * @param {Object} models Sequelize database models
   * @param {Object} adapter adapter service which converts database model to logical model
   * @param {Object} updatedFields delta object containing the changes to be persisted into the given post object
   * @param {Object} filters object containing filter parameters, currently supported are:
   * postId : id of post to be updated
   * discoursePostId: discourse post id of the post to be updated
   * @param {String} reqUserId id of the user requesting the operation
   * @param {Object} transaction the transaction
   *
   * @return {Promise} promise which resolves to logical model of the updated post
   */
  Post.updatePost = (models, adapter, updatedFields, { postId, discoursePostId }, reqUserId, transaction) => {
    const where = { deletedAt: { [Sequelize.Op.eq]: null } };
    if (postId) {
      where.id = postId;
    }
    if (discoursePostId) {
      where.discoursePostId = discoursePostId;
    }
    return models.posts.update(
      Object.assign({}, updatedFields, { updatedBy: reqUserId }),
      {
        where,
        returning: true,
        plain: true,
      }, { transaction })
      .then((result) => { // result is [x ,y] : x is number of rows affected, y is actual affected row
        models.logger.debug('post updated...');
        return adapter.adaptPost(result[1]);
      });
  };

  return Post;
};
