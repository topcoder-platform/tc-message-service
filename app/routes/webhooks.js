
const { EVENT } = require('../constants');
const Discourse = require('../services/discourse');

module.exports = (req, res) => {
  const dPost = req.body.post;
  const logger = req.log;
  const discourseClient = Discourse(logger);

  discourseClient.getPost(dPost.username, dPost.topic_id).then((post) => {
    if (post.via_email === true) {
      req.app.emit(EVENT.POST_CREATED, { post, req });
      res.json({
        status: 200,
        message: 'Event recieved !',
      });
    }
  }).catch((err) => {
    res.json({
      status: 500,
      error: err,
    });
  });
};
