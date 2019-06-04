
const aws = require('aws-sdk');
const config = require('config');
const util = require('tc-core-library-js').util(config);
const errors = require('common-errors');
const Joi = require('joi');
const _ = require('lodash');
const HelperService = require('../../services/helper');
const Adapter = require('../../services/adapter');


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
    const reqParams = Joi.attempt(req.params, Joi.object().keys({
      attachmentId: Joi.number().required(),
    }).unknown());

    const params = {};
    params.attachmentId = reqParams.attachmentId;

    const userId = req.authUser.userId.toString();
    const isAdmin = helper.isAdmin(req);
    let attachment;

    return db.post_attachments.findOne({ where: { id: params.attachmentId } })
    .then((att) => {
      if (!att || att.deletedAt) {
        throw new errors.HttpStatusError(404, 'Could not find the requested attachment');
      }
      attachment = att;
      if (!attachment.postId) {
        throw new errors.HttpStatusError(404, 'Can not delete requested attachment');
      }
      return db.posts.findPosts(db, adapter, { id: attachment.postId })
      .then((posts) => {
        if (!posts) {
          throw new errors.HttpStatusError(404, 'Requested post cannot be found');
        }

        const topicId = posts[0].topicId;
        return db.topics.findTopic(db, adapter, { topicId })
          .then((topic) => {
            const referenceId = topic.referenceId;
            return helper.callReferenceEndpoint(req.authToken, req.id, topic.reference, referenceId)
              .then(async (hasAccessResp) => {
                const hasAccess = await helper.userHasAccessToEntity(userId, hasAccessResp, _.split(topic.tag, ','),
                  topic.reference);
                if (!hasAccess && !isAdmin) {
                  throw new errors.HttpStatusError(403, 'User doesn\'t have access to the project');
                }

                if (!isAdmin && attachment.createdBy !== req.authUser.userId) {
                  throw new errors.HttpStatusError(403, 'User doesn\'t have delete access to the attachment');
                }
                // all good, we can delete the attachment
                const s3 = new aws.S3(config.get('aws.config'));
                return s3.deleteObject({
                  Bucket: config.get('aws.S3.targetBucket'),
                  Key: helper.s3KeyFromUrl(attachment.url),
                }).promise();
              }).then(() => attachment.update({
                deletedAt: db.sequelize.fn('NOW'),
                deletedBy: req.authUser.userId.toString(),
              }))
              .then(() => {
                resp.status(200).send(util.wrapResponse(req.id));
              });
          });
      });
    })
      .catch((error) => {
        logger.error(error);
        next(error instanceof HttpStatusError ? error : new HttpStatusError(500, 'Error deleting attachment'));
      });
  };
