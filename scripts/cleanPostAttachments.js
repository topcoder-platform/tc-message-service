const aws = require("aws-sdk");
const config = require("config");
const Promise = require("bluebird");
const Sequelize = require("sequelize");
const _ = require("lodash");

const s3 = new aws.S3(config.get("aws.config"));

const parseS3URL = s3URL => {
  const file = {};
  file.bucket = s3URL
    .split("/")
    .slice(2, 3)
    .join("/");
  file.key = s3URL
    .split("/")
    .slice(3)
    .join("/");
  return file;
};

const deleteAfter = config.get("attachmentConfig.deleteAfter");
const query = `SELECT * FROM post_attachments WHERE "postId" IS NULL AND NOW() - "createdAt" > INTERVAL '${deleteAfter}';`;

const sequelize = new Sequelize(config.get("dbConfig.masterUrl"), {
  logging: false
});

const PostAttachments = sequelize.import("../app/models/postAttachments");
sequelize.query(query, { model: PostAttachments }).then(attachments => {
  _.each(attachments, attachment => {
    const file = parseS3URL(attachment.url);
    var params = {
      Bucket: file.bucket,
      Key: file.key
    };
    s3.deleteObject(params, function(err, data) {
      if (err) {
        console.log(err);
      } else {
        console.log(`${file.key} physically deleted from the bucket `);
        attachment
          .destroy()
          .then(() => {
            console.log(
              `Attachment removed from the DB (ID: ${attachment.id})`
            );
          })
          .catch(() => {
            console.log(
              `Error: Cannot remove attachment from the DB (ID: ${
                attachment.id
              })`
            );
          });
      }
    });
  });
});