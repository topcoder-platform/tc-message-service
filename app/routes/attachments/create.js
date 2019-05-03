
const aws = require('aws-sdk');
const config = require('config');
const util = require('tc-core-library-js').util(config);
const errors = require('common-errors');
const Joi = require('joi');
const Promise = require('bluebird');
const moment = require('moment');

const HttpStatusError = errors.HttpStatusError;

/**
 * Returns file path to be used in s3.moveObject function
 * Supports both cases if file is in root directory or in subdirectory
 * (e.g. s3://bucket/subdir/file.ext)
 * (e.g. s3://bucket/file.ext)
 *
 * Supports all path types of 'subdir', 'subdir/', '/subdir' ...
 *
 * @param {Object} file The file object containing filename, bucket, path
 * @return {string} URL-encoded path of the file
 */
const getSourceBucketPath = (file) => {
  // file is in path
  if (file.path && file.path !== '/') {
    // handles 'subdir/' case
    if (file.path.substr(-1) === '/') {
      file.path = file.path.substr(0, file.path.length - 1);
    }

    // handles '/subdir' case
    if (file.path.substr(0, 1) === '/') {
      file.path = file.path.substr(1, file.path.length - 1);
    }

    return encodeURI(`/${file.bucket}/${file.path}/${file.filename}`);
  }
  // file is in the root directory
  return encodeURI(`/${file.bucket}/${file.filename}`);
};

/**
 * Returns unsigned S3 resource URL for the given file
 *
 * @param {Object} file File object with s3Bucket and s3Key properties
 * @return {string} Unsigned S3 resource URL
 */
const getS3URL = file => `s3://${file.s3Bucket}/${file.s3Key}`;

/**
 * Copies the given object from source (public) bucket to target bucket
 *
 * Configuration parameters in the config/default.json
 * aws.S3.targetBucket - the object will be copied to this bucket
 * aws.S3.storageDir - the object will be stored in this directory (in the target bucket)
 *
 * File name format: TIMESTAMP_originalFileName.ext
 *
 * @param {Object} file The file object containing filename, bucket, path
 * @param {Object} req Request
 * @return {Object} The same file object with additionally targetS3Key and targetBucket
 */
const moveObject = (file, req) => new Promise((resolve, reject) => {
  const logger = req.log;

  const s3 = new aws.S3(config.get('aws.config'));
  const targetBucket = config.get('aws.S3.targetBucket');
  const storageDir = config.get('aws.S3.storageDir');
  const timeStamp = Date.now();

  const targetS3Key = `${storageDir}/${timeStamp}_${file.filename}`;

  const params = {
    Bucket: targetBucket,
    CopySource: getSourceBucketPath(file),
    Key: targetS3Key,
  };
  s3.moveObject(params, (err) => {
    if (err) {
      logger.error(err);
      reject(err);
    }
    file.s3Bucket = targetBucket;
    file.s3Key = targetS3Key;
    resolve(file);
  });
});

/**
 * Handles creation of attachments
 * @param {Object} db sequelize db with all models loaded
 * @return {Object} response object
 */
module.exports = db =>
  (req, resp, next) => {
    const logger = req.log;

    // Validate the authentication
    Joi.assert(req.authUser, Joi.object().keys({
      handle: Joi.string().required(),
    }).unknown());

    // validate req parameters and create a file object from request
    const fileInfo = Joi.attempt(req.body, Joi.object().keys({
      filename: Joi.string().required(),
      bucket: Joi.string().required(),
      path: Joi.string().optional(),
    }).unknown());

    // check rate limits
    return db.post_attachments.count({
      where: {
        createdBy: req.authUser.handle,
        postId: null,
        createdAt: { $gt: moment().add(-1, 'hours') },
      },
    })
    .then((count) => {
      if (count > config.maximumUnassignedAttachments) {
        throw new errors.HttpStatusError(429, 'Rate limit - too many unassigned attachments');
      }
      return Promise.resolve();
    })
    .then(() => moveObject(fileInfo, req))
    .then((file) => {
      logger.info('Attachment copied to the target bucket', file);
      return file;
    })
    .then(file => db.post_attachments.create({
      postId: null,
      originalFileName: file.filename,
      url: getS3URL(file),
      createdBy: req.authUser.handle,
        // follow sequelize on how it fills updatedAt on creation
      updatedBy: req.authUser.handle,
    }))
    .then((createdPostAttachment) => {
      const content = createdPostAttachment.toJSON();
      logger.info('Attachment uploaded', content);
      // remove excluded attributes from the response
      ['deletedAt', 'deletedBy', 'url'].forEach(attribute => delete content[attribute]);
      resp.status(200).send(util.wrapResponse(req.id, content));
    })
    .catch((error) => {
      logger.error(error);
      next(error instanceof HttpStatusError ? error : new HttpStatusError(500, 'Error copying attachment'));
    });
  };
