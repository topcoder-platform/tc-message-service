import _ from 'lodash';

const config = require('config');
const jwt = require('jsonwebtoken');
const errors = require('common-errors');
const HelperService = require('../../services/helper');
const { EVENT } = require('../../constants');
/**
 * Sendgrid webhook callback
 * @param {Object} db the db
 * @return {object} response
 */
module.exports = db => (req, resp, next) => {
  const logger = req.log;
  const helper = HelperService(logger, db);
  logger.info('Entered Sendgrid webhook handler');
  logger.trace(req.fields);
  const payload = req.fields;
  let rawText = payload.text;
  logger.debug(rawText, 'rawText');
  rawText = rawText.replace(/.*On(.*?)wrote:([\s\S]*.*?)$/gmi, '');
  logger.debug(rawText, 'rawText.cleaned');
  const subject = payload.subject;
  const ccAddresses = payload.cc || '';
  let envelope;
  let fromAddress;
  let toAddress;
  let status = 'success';
  if (payload.envelope) {
    envelope = JSON.parse(payload.envelope);
  }
  if (envelope) {
    fromAddress = envelope.from;
    toAddress = envelope.to[0];
  }
  let emailInfo = null;
  let topicId = null;
  let token = null;
  logger.trace('Envelope parsed successfully');
  try {
    emailInfo = toAddress.substring(toAddress.indexOf('+') + 1, toAddress.indexOf('@'));
    topicId = parseInt(emailInfo.substring(0, emailInfo.indexOf('/')), 10);
    token = emailInfo.substring(emailInfo.indexOf('/') + 1);
  } catch (ex) {
    logger.error(`Can't parse incomming email with payload ${payload}`, ex);
    resp.status(200).send(''); // no need to retry if the email can't be parsed
    // eslint-disable-next-line
	  return Promise.resolve();
  }
  logger.trace(`token=> ${token}`);

  logger.debug(`Processing email from ${fromAddress} to ${toAddress} with token ${token} and topic id ${topicId}`);
  return helper.lookupPossibleUsersFromEmail(fromAddress, true)
  .then((users) => {
    logger.debug(`Got users by email lookup ${users}`);
    let userId = null;
    const user = _.find(users, (usr) => {
      userId = parseInt(usr.id, 10);
      // get jwt token then encode it with base64
      const body = {
        userId,
        topicId,
        userEmail: helper.sanitizeEmail(usr.email),
      };
      const correctToken = jwt.sign(body, config.authSecret, { noTimestamp: true }).split('.')[2];
      logger.trace(`correctToken[${userId}]=> ${correctToken}`);

      return correctToken === token;
    });

    return db.topics.findById(topicId)
    .then((topic) => { /* eslint no-param-reassign: ["error", { "props": true, "ignorePropertyModificationsFor": ["topic"] }] */
      if (!topic) {
        logger.debug(`Topic ${topicId} not found in the database`);
        status = 'fail-topic-not-found';
      }
      if (!user) {
        logger.error('incoming email token is not valid');
        status = 'fail-invalid-token';
      }
      const emailLog = db.email_logs.build({
        fromAddress,
        toAddress,
        ccAddresses,
        subject,
        rawText,
        userId,
        topicId,
        postId: 0,
        token,
        status,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return emailLog.save()
      .then(() => {
        logger.info('email log saved in Postgres');
        if (status !== 'success') {
          logger.error(`Error in processing sendgrid webhook: ${status}`);
          // send 200 to sendgrid, no need to let it retry, we can look into email logs for this
          resp.status(200).send(status);
          return;
        }

        logger.debug(`Topic ${topicId} found in the database. Creating post...`);
        // eslint-disable-next-line
        return db.posts.createPost(db, rawText, topic, userId).then((savedPost) => {
          logger.info('post created');
          topic.highestPostNumber += 1;
          topic.save().then(() => logger.debug('topic updated async for post: ', savedPost.id));
          // creates an entry in post_user_stats table for tracking user actions against this post
          // right now it only creates entry for 'READ' action, in future we may create more entries
          // when we support more actions e.g. 'LIKE', 'BOOKMARK', 'FAVORITE' etc
          db.post_user_stats.createStats(db, logger, {
            post: savedPost,
            userId,
            action: 'READ',
          }).then(() => logger.debug('post_user_stats entry created for post: ', savedPost.id));

          // emit post creation event
          // eslint-disable-next-line
          req.authUser = { userId };
          req.app.emit(EVENT.POST_CREATED, { post: savedPost, topic, req });
          return resp.status(200).send('');
        });
      });
    });
  })
  // send 500 status code back to sendgrid if any error occurs
  // eslint-disable-next-line
  .catch((err) => {
    logger.error(err);
    next(new errors.HttpStatusError(500, 'webhook error'));
  });
};
