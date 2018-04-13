

const _ = require('lodash');
const config = require('config');
const axios = require('axios');
const errors = require('common-errors');
const util = require('../util');
const { USER_ROLE } = require('../constants');
const { REFERENCE_LOOKUPS } = require('../constants');

/**
 * Returns helper service containing common functions used in route handlers
 * @param {Object} logger the logger
 * @param {Object} db sequelize db with all models loaded
 * @return {function} function
 */
module.exports = (logger, db) => {
  /**
   * Helper method to clean up the provided email address for deducing the final address that matters for
   * the delivery of the email i.e. removing any non standard parts in the email address e.g. getting rid
   * of anything after + sign in the local part of the email.
   *
   * @param {String} email email address to be sanitized
   *
   * @returns {String} sanitized email
   */
  function sanitizeEmail(email) {
    if (email) {
      return email.substring(0, email.indexOf('+')) + email.substring(email.indexOf('@'));
    }
    return '';
  }

  /**
   * Lookup topic from previous service.
   * @param  {Number} topicId the id of the topic we want
   * @return {Promise} promise
   */
  function lookupTopic(topicId) {
    const url = `${config.get('topicServiceUrl')}/${topicId}`;
    logger.debug(`Helper.lookupTopic for topicId: ${topicId} against ${url}`);

    return util.getSystemUserToken(logger)
    .then((token) => {
      logger.debug(`Bearer ${token}`);
      return axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      })
      .then((response) => {
        const data = _.get(response, 'data.result.content', null);
        if (!data) { throw new Error('Response does not have result.content'); }
        logger.debug('Helper.lookupTopic response', data);
        return data;
      });
    });
  }

  /**
   * Lookup user handles from emails
   * @param  {Array} userEmails user emails
   * @param {Boolean} isPattern flag to indicate that pattern matching is required or not
   * @return {Promise} promise
   */
  function lookupUserEmails(userEmails, isPattern = false) {
    logger.debug(`${config.get('identityServiceEndpoint')}`);
    let filter = _.map(userEmails, i => `email=${i}`).join(' OR ');
    if (isPattern) {
      filter += '&like=true';
    }
    logger.debug('filter for users api call', filter);
    return util.getSystemUserToken(logger)
    .then((token) => {
      logger.debug(`Bearer ${token}`);
      return axios.get(`${config.get('identityServiceEndpoint')}users`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        params: {
          fields: 'handle,id,email',
          filter,
        },
      })
      .then((response) => {
        const data = _.get(response, 'data.result.content', null);
        if (!data) { throw new Error('Response does not have result.content'); }
        logger.debug('UserHandle response', data);
        return data;
      });
    });
  }

  /**
   * Lookup user handles from userIds
   * @param  {Array} userIds user Identifiers
   * @return {Promise} promise
   */
  function lookupUserHandles(userIds) {
    return axios.get(`${config.get('memberServiceUrl')}/_search`, {
      params: {
        fields: 'handle',
        query: _.map(userIds, i => `userId:${i}`).join(' OR '),
      },
    }).then((response) => {
      const data = _.get(response, 'data.result.content', null);
      if (!data) { throw new Error('Response does not have result.content'); }
      logger.debug('UserHandle response', data);
      return _.map(data, 'handle').filter(i => i);
    });
  }

  /**
   * Fetches a topcoder user from the topcoder members api
   * @param {String} handle handle of the user to fetch
   * @return {Promise} promise
   */
  function getTopcoderUser(handle) {
    // get admin user token and make the call to member service endpoint
    logger.debug('retrieving userToken');
    return util.getSystemUserToken(logger)
      .then((token) => {
        logger.debug('retrieved token invoking member service');
        return axios.get(`${config.memberServiceUrl}/${handle}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        });
      })
      .then((response) => {
        // logger.debug('retrieved user', response.data);
        if (!_.get(response, 'data.result.content')) { throw new Error('Response does not have result.content'); }
        return response.data.result.content;
      });
  }

  /**
   * finds handle of user from userId,
   * @param {Number} userId userId of user
   * @return {Promise} promise
   */
  function lookupUserFromId(userId) {
    return lookupUserHandles([userId])
      .then(handles => getTopcoderUser(handles[0]));
  }

    /**
   * finds handle of user from email,
   * @param {Number} userEmail email of user
   * @return {Promise} promise
   */
  function lookupPossibleUsersFromEmail(userEmail) {
    return lookupUserEmails([userEmail])
      .then((users) => {
        if (users && users.length > 0) {
          return users[0];
        }
        const emailLocal = userEmail.substring(0, userEmail.indexOf('@'));
        const emailLocalSanitized = sanitizeEmail(emailLocal);
        return lookupUserEmails([`${emailLocalSanitized}*`], true)
          .then(possibleUsers => possibleUsers);
      });
  }

  /**
   * Verifies if a user has access to a certain topcoder entity such as a project,
   * challenge, or submission, by making a call to the api configured in the referenceLookup table
   * @param {String} authToken user's auth token to use to call the api
   * @param {String} requestId request identifier
   * @param {String} reference name of the reference, used to find the endpoint in the referenceLookupTable
   * @param {String} referenceId identifier of the reference record
   * @return {Promise} promise
   */
  function callReferenceEndpoint(authToken, requestId, reference, referenceId) {
    return db.reference_lookups.findOne({ where: { reference } })
    .then((result) => {
      if (!result) {
        logger.debug('no result');
        return [true, null]; // if nothing exists in the referenceLookup table, the entity should be open,
        // and anyone should be able to see the threads
      }
      const referenceLookup = result;
      return axios.get(referenceLookup.endpoint.replace('{id}', referenceId), {
        headers: {
          'X-Request-Id': requestId,
          Authorization: `Bearer ${authToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        timeout: config.get('referenceLookupTimeout'),
      }).then((response) => {
        logger.debug(_.get(response, 'data.result.status', 'Reference endpoint status'));
        if (response.data && response.data.result &&
          response.data.result.status === 200 && response.data.result.content) {
          return [true, response.data.result.content];
        }
        return [false, null];
      }).catch((error) => {
        logger.debug(error);
        return [false, null, error];
      });
    }).catch((error) => {
      logger.debug(error);
      return [false, null, error];
    });
  }

  function userHasAccessToEntity(userId, hasAccessResp, reference) {
    logger.info('Checking if user has access to project');
    const hasAccess = hasAccessResp[0];
    if (hasAccess && reference.toLowerCase() === REFERENCE_LOOKUPS.PROJECT) {
      const projectMembers = _.get(hasAccessResp[1], 'members', []);
        // get users list
      const isMember = _.filter(projectMembers, member => member.userId.toString() === userId).length > 0;
      logger.debug(isMember, 'isMember');
      return isMember;
    }
    return false;
  }

  /**
   * Checks if a user has access to an entity, and if they do, provision a user in Discourse if one doesn't exist
   * @param {String} authToken user's auth token to use to call the Topcoder api to get user info for provisioning
   * @param {String} requestId request identifier
   * @param {String} userId userId of the user
   * @param {String} reference name of the reference, used to find the endpoint in the referenceLookupTable
   * @param {String} referenceId identifier of the reference record
   * @return {Promise} promise
   */
  function checkAccessAndProvision(authToken, requestId, userId, reference, referenceId) {
    return this.userHasAccessToEntity(authToken, requestId, reference, referenceId).then((resp) => {
      const hasAccess = resp[0];
      logger.debug(`hasAccess: ${hasAccess}`);
      if (!hasAccess) {
        throw new errors.HttpStatusError(403, 'User doesn\'t have access to the entity');
      }
    }).then(() => {
      logger.info('User has access to entity');
      return this.getUserOrProvision(userId);
    });
  }


  /**
   * Returns handle or userId from @ mentions
   * @param {Object} match:  @mention
   * @return {object} object
   */
  function getContentFromMatch(match) {
    return match.slice(2);
  }

  function isAdmin(req) {
    return _.intersection([
      USER_ROLE.TOPCODER_ADMIN,
      USER_ROLE.CONNECT_ADMIN,
      USER_ROLE.MANAGER,
    ], req.authUser.roles).length > 0;
  }

  function s3KeyFromUrl(url) {
    return (url && url.replace(/http[s]?:\/\//, '').split('/').slice(1).join('/')) || '';
  }

  return {
    getTopcoderUser,
    lookupUserHandles,
    lookupUserFromId,
    lookupPossibleUsersFromEmail,
    userHasAccessToEntity,
    callReferenceEndpoint,
    checkAccessAndProvision,
    getContentFromMatch,
    isAdmin,
    s3KeyFromUrl,
    lookupTopic,
    sanitizeEmail,
  };
};
