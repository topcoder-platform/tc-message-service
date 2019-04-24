
const aws = require('aws-sdk');
const config = require('config');
const errors = require('common-errors');
const HelperService = require('../../services/helper');
const Joi = require('joi');
const Adapter = require('../../services/adapter');

const s3 = new aws.S3(config.get('aws.config'));
const HttpStatusError = errors.HttpStatusError;

/**
 * Get specific attachment
 * @param {Object} db sequelize db with all models loaded
 * @param {Object} m2m machine to machine token helper object
 * @return {Object} response
 */
module.exports = (db, m2m) =>
  /**
   * Redirects to the specified attachment for the specified post, and in the process it does:
   *  - Checks if the user has access to the project
   *  - Makes sure the attachment is available (present and not soft deleted)
   */
  (req, resp, next) => {
    const logger = req.log;
    const helper = HelperService(logger, db, m2m);
    const adapter = new Adapter(logger, db);

    // Validate request parameters
    Joi.assert(req.authUser, Joi.object().keys({
      handle: Joi.string().required(),
    }).unknown());
    const reqParams = Joi.attempt(req.params, Joi.object().keys({
      attachmentId: Joi.number().required(),
    }));

    const params = {};
    params.attachmentId = reqParams.attachmentId;
    const userId = req.authUser.userId.toString();
    let attachment;

    return db.post_attachments.findOne({ where: { id: params.attachmentId } })
      .then((postAttachment) => {
        if (!postAttachment || postAttachment.deletedAt) {
          throw new errors.HttpStatusError(404, 'Could not find the requested attachment');
        }
        if (!postAttachment.postId) {
          throw new errors.HttpStatusError(404, 'Attachment is not available');
        }
        attachment = postAttachment;
        return db.posts.findPosts(db, adapter, { id: attachment.postId });
      })
      .then((posts) => {
        if (!posts) {
          throw new errors.HttpStatusError(404, 'Attachment post cannot be found');
        }

        const topicId = posts[0].topicId;
        return db.topics.findTopic(db, adapter, { topicId })
          .then((topic) => {
            const referenceId = topic.referenceId;
            return helper.callReferenceEndpoint(req.authToken, req.id, topic.reference, referenceId)
              .then((hasAccessResp) => {
                const hasAccess = helper.userHasAccessToEntity(userId, hasAccessResp, topic.reference);
                if (!hasAccess && !helper.isAdmin(req)) {
                  throw new errors.HttpStatusError(403, 'User doesn\'t have access to the project');
                }
                // all is good, return the attachment
                const signedUrl = s3.getSignedUrl('getObject', {
                  Bucket: config.get('aws.S3.targetBucket'),
                  Key: helper.s3KeyFromUrl(attachment.url),
                });
                logger.debug(attachment.url);
                logger.debug(signedUrl);
                resp.redirect(signedUrl);
              });
          });
      })
      .catch((error) => {
        logger.error(error);
        next(error instanceof HttpStatusError ? error : new HttpStatusError(500, 'Error getting attachment'));
      });
  };
