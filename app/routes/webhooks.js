
const { EVENT } = require('../constants');

module.exports = (req, res) => {
  const post = req.body.post;
  post.body = post.cooked;

  req.app.emit(EVENT.POST_REPLY, { post, req });
  res.json({
    status: 200,
    message: 'Event recieved !',
  });
};
