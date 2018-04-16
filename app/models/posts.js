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
  }, {
    freezeTableName: true,
  });

  Post.associate = (models) => {
    Post.hasMany(models.post_user_stats, { as: 'userStats', foreignKey: 'postId' });
  };

  Post.createPost = (models, postBody, topic, reqUserId, discoursePostId = null) => {
    // const now = new Date();
    const post = models.posts.build({
      topicId: topic.id,
      discoursePostId,
      raw: postBody,
      postNumber: topic.highestPostNumber + 1,
      viaEmail: false,
      hidden: false,
      // createdAt: now,
      createdBy: reqUserId,
      // updatedAt: now,
      updatedBy: reqUserId,
    });
    return post.save();
  };

  Post.getTopicPostsCount = (topicId, countDeleted = false) => {
    const where = { topicId };
    if (!countDeleted) {
      where.deletedAt = { [Sequelize.Op.eq]: null };
    }
    return Post.count({
      where,
    });
  };

  Post.getPostsCount = (topicIds, countDeleted = false) => {
    const where = { topicId: { [Sequelize.Op.in]: topicIds } };
    if (!countDeleted) {
      where.deletedAt = { [Sequelize.Op.eq]: null };
    }
    return Post.findAll({
      where,
      attributes: ['topicId', [Sequelize.fn('COUNT', Sequelize.col('id')), 'totalPosts']],
      group: ['topicId'],
    });
  };

  Post.findPosts = (adapter, filters, fetchDeleted = false) => {
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

  Post.findPost = (models, adapter, { topicId, postId, raw = false, fetchDeleted = false }) => {
    const where = { id: postId, topicId };
    if (!fetchDeleted) {
      where.deletedAt = { [Sequelize.Op.eq]: null };
    }
    return Post.findOne({
      where,
      raw,
    }).then((post) => {
      if (!post) return null;
      return adapter.adaptPost(post);
    });
  };

  Post.updatePost = (models, adapter, updatedFields, { postId, discoursePostId, reqUserId }) => {
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
      })
    .then((result) => { // result is [x ,y] : x is number of rows affected, y is actual affected row
      console.log('post updated...');
      return adapter.adaptPost(result[1]);
    });
  };

  return Post;
};
