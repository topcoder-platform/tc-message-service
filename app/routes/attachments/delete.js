
const aws = require('aws-sdk');
const config = require('config');
const util = require('tc-core-library-js').util(config);
const errors = require('common-errors');
const Joi = require('joi');
const HelperService = require('../../services/helper');
const Adapter = require('../../services/adapter');

const s3 = new aws.S3(config.get('aws.config'));
const HttpStatusError = errors.HttpStatusError;

/**
 * Handles creation of attachments
 * @param {Object} db sequelize db with all models loaded
 * @param {Object} m2m machine to machine token helper object
 * @return {Object} response object
 */
module.exports = (db, m2m) =>
  /**
   * Upload image to Discourse
   */
  (req, resp, next) => {
    const logger = req.log;
    const helper = HelperService(logger, db, m2m);
    const adapter = new Adapter(logger, db);

    // Validate request parameters
    Joi.assert(req.authUser, Joi.object().keys({
      handle: Joi.string().required(),
    }).unknown());
    const bodyParams = Joi.attempt(req.body, Joi.object().keys({
      postId: Joi.number().required(),
      hardDelete: Joi.boolean().optional(),
    }).unknown());
    const reqParams = Joi.attempt(req.params, Joi.object().keys({
      attachmentId: Joi.number().required(),
    }).unknown());

    const params = {};
    params.postId = bodyParams.postId;
    params.hardDelete = bodyParams.hardDelete;
    params.attachmentId = reqParams.attachmentId;

    const userId = req.authUser.userId.toString();
    const isAdmin = helper.isAdmin(req);

    return db.posts.findPosts(db, adapter, { id: params.postId })
      .then((posts) => {
        if (!posts) {
          throw new errors.HttpStatusError(404, 'Requested post cannot be found');
        }

        const topicId = posts[0].topicId;
        return db.topics.findTopic(db, adapter, { topicId })
          .then((topic) => {
            const referenceId = topic.referenceId;
            return helper.callReferenceEndpoint(req.authToken, req.id, topic.reference, referenceId)
              .then((hasAccessResp) => {
                const hasAccess = helper.userHasAccessToEntity(userId, hasAccessResp, topic.reference);
                if (!hasAccess && !isAdmin) {
                  throw new errors.HttpStatusError(403, 'User doesn\'t have access to the project');
                }

                return db.post_attachments.findOne({ where: { id: params.attachmentId, postId: params.postId } });
              })
              .then((postAttachment) => {
                if (!postAttachment || (!params.hardDelete && postAttachment.deletedAt && !isAdmin)) {
                  // also take into account when a non admin user is trying to delete a soft deleted record, which he shouldn't
                  // have access to.. return as if the attachment doesn't exist
                  throw new errors.HttpStatusError(404, 'Could not find the requested attachment');
                }
                if (!isAdmin && params.hardDelete) {
                  throw new errors.HttpStatusError(403, 'User cannot hard delete attachment');
                }
                if (!isAdmin && postAttachment.createdBy !== req.authUser.handle) {
                  throw new errors.HttpStatusError(403, 'User doesn\'t have delete access to the attachment');
                }
                if (params.hardDelete) {
                  return Promise.all([
                    s3.deleteObject({
                      Bucket: config.get('aws.S3.targetBucket'),
                      Key: helper.s3KeyFromUrl(postAttachment.url),
                    }).promise(),
                    postAttachment.destroy(),
                  ]);
                }
                if (postAttachment.deletedAt) {
                  // attachment is soft deleted
                  if (isAdmin) {
                    // soft deleting a soft deleted record doesn't make sense, return an error
                    throw new errors.HttpStatusError(400, 'Attachment is already soft deleted');
                  }
                  // scenario when non admin, record is soft deleted and user wants to soft delete has already been handled,
                  // return to prevent any future bugs
                  return null;
                }
                return postAttachment.update({
                  deletedAt: db.sequelize.fn('NOW'),
                  deletedBy: req.authUser.handle,
                });
              })
              .then(() => {
                resp.status(200).send(util.wrapResponse(req.id));
              });
          });
      })
      .catch((error) => {
        logger.error(error);
        next(error instanceof HttpStatusError ? error : new HttpStatusError(500, 'Error deleting attachment'));
      });
  };
