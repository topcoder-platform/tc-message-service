# Purpose of this Document

The purpose of this document is to describe how to run and test the messaging service  locally for development purposes.

# Overview

The message service provides apis for members to be able to collaborate within the topcoder platform. It provides capabilities to create public and private threaded conversations associated with specific topcoder entities such as projects, challenges, submissions, etc. and general discussions not associated with any specific entity.

We will be using docker-compose to stand up all the real and mock up services required to run the messaging service:

1. Member service mock-up: service to fetch user data;
2. Submission service mock-up: service to fetch submissions, which we will use as an example entity to which we will tie threads;
3. Postgres: the main database of the message service;
4. Message service: the api that exposes Discourse functionality; This is old discourse based message service which is needed only during transition period of discourse migration.

# Pre-Requisites

To prepare your system to run the submission service, please setup the following:

## Docker

We will use Docker for virtualization and so all services run reliably in separate sandboxes, please install docker following the instructions here:

https://docs.docker.com/engine/installation/

## Docker Compose

To help manage multiple docker instances running together, we will use docker compose, you can set it up by following the instructions here:

https://docs.docker.com/compose/install/

## Nodejs and Npm

Install nodejs and npm, instructions can be found here: https://nodejs.org/en/, please use 6.4.x version

## Sequelize cli

Install the sequelize command line interface by following the instructions found here: https://github.com/sequelize/cli

## AWS (S3)

You will need a AWS account and an existing S3 bucket. The `config/default.json` file contains the following sso related properties.  Also remember to give your AWS account user admin access to both S3 and DynamoDB.

- aws
 - config - configuration related to credentials and region to use
  - accessKeyId - the AWS access key
  - region - the region to to use (i.e. us-east-1)
  - secretAccessKey - the AWS secret access key
 - S3 - configuration related to S3
  - bucket - the bucket name

Note that all these properties have their corresponding environment variables that can be setup:

- aws
 - config - configuration related to credentials and region to use
  - accessKeyId - AWS_ACCESS_KEY_ID
  - region - AWS_REGION
  - secretAccessKey - AWS_SECRET_ACCESS_KEY
 - S3 - configuration related to S3
  - bucket - AWS_S3_BUCKET
 - dynamodb - dynamodb config
  - discourseWebhookLogsTable - log table for discourse webhooks

# Local Setup

## Hosts

Update your localhost entry in your hosts file (/etc/hosts or C:\Windows\System32\drivers\etc\hosts on Windows) to map *talk.topcoder-dev.com* and *local.topcoder-dev.com* to the ip address of your docker ip:

```properties
<docker_ip> local.topcoder-dev.com talk.topcoder-dev.com
```
On Linux the docker ip should be 127.0.0.1. On OSX/Windows if you use docker machine, find the docker ip with command ``docker-machine ip``

## Source Code

```shell
git clone https://github.com/topcoder-platform/tc-message-service.git
```

We will refer to this folder henceforth as tc-message-service.

## Webhooks
Discourse also needs webhooks enabled.  To do this, login to Discourse as an admin and go to

`Settings -> API -> Webhooks`

Next, set the `Payload URL` to match the url of this deployed service.

`https://{hostname}/{version}/webhooks/discourse`

From there, set the `Secret` field to match the `discourseWebhookSecret` config in `default.json`.  This is the shared secret that will allow the two systems to communicate.

The next step is to turn on the specific webhooks that we want.  In this case, `Post Event` and `Topic Event` should be sufficient.

Lastly, check the `Active` checkbox and then click `Save`.


# Starting the Application

## Running the Dependencies

Go into the tc-message-service/local folder of this repository and start the docker services:

```shell
docker-compose up
```

## Setting up Environment Variables

```shell
export DB_MASTER_URL=postgres://coder:mysecretpassword@local.topcoder-dev.com:5432/messages
export AWS_ACCESS_KEY_ID=<<AWS access key>>
export AWS_REGION=<<AWS region>>
export AWS_SECRET_ACCESS_KEY=<<AWS secret access key>>
export AWS_S3_BUCKET=<<AWS S3 bucket>>
export DISCOURSE_WEBHOOK_SECRET=<<DISCOURSE_WEBHOOK_SECRET>>
```

NOTE:

- You may need to change DB_MASTER_URL if running under differnt host or port

## Install Dependent Packages

In the tc-message-service folder issue the following command:
```shell
npm install
```
Note: npm install only has to be executed the first time when you set up the service, and whenever changes are made to the packages.json file

## Creating the Database Schema

Connect to postgres using psql locally or from the postgres docker container, using coder/mysecretpassword to login, create `messages` and `messages_test` databases:

```shell
psql postgres coder -h local.topcoder-dev.com
# Password for user coder: mysecretpassword
CREATE DATABASE messages;
CREATE DATABASE messages_test;
```

We use sequelize to create and manage the database schema, to create the schema in Postgres, simply go into the tc-message-service folder and issue the following command:

```shell
NODE_ENV=development sequelize db:migrate
NODE_ENV=test sequelize db:migrate
```

We will also need to create the dynamodb log table for the discourse webhooks.  To create this table, make sure you are at the project root and run:

```shell
node ./scripts/createDiscourseWebhookLogTable.js
```

## Running the Service

To run the service in dev mode, go into the tc-message-service folder and issue the following command:

```shell
npm run start:dev
```
This will start service on 8001 port.



# Verify the service

## Setting up Security for Reference Lookups

The message system assumes that if a user has access to an entity at topcoder, they can therefore participate in discussions associated with that entity. The referenceLookup table in Postgres provides a map to determine with API endpoint should be invoked on behalf of the user, by using the user's authentication token, to check if the record is retrievable. If the record is returned, then the user is allowed to view and participate in the discussion.

We are going to use submissions as the entity, and in order to setup the lookup we need to insert a record into the referenceLookup table.

Login to postgres either by install psql locally, or entering the postgres docker container:

```shell
psql messages coder -h local.topcoder-dev.com
```

And execute the following statements:

```sql
INSERT INTO "reference_lookups" (reference, endpoint, "createdAt", "updatedAt") VALUES ('submission', 'http://local.topcoder-dev.com:3001/submissions/{id}', now(), now());
INSERT INTO "reference_lookups" (reference, endpoint, "createdAt", "updatedAt") VALUES ('project', 'https://api.topcoder-dev.com/v4/projects/{id}', now(), now());
```

## Obtaining a JWT token

JWT is used to authenticate calls to the service, and an unexpired JWT token is required to be passed in the Authorization header for any calls made to the service.

This JWT token can be used to impersonate the user magrathean:

```
eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6WyJhZG1pbmlzdHJhdG9yIl0sImlzcyI6Imh0dHBzOi8vYXBpLnRvcGNvZGVyLWRldi5jb20iLCJoYW5kbGUiOiJtYWdyYXRoZWFuIiwiZXhwIjoxNzY2Mjg5MjQ2LCJ1c2VySWQiOiI0MDAxMTU3OCIsImlhdCI6MTQ1MDkyOTI0NiwiZW1haWwiOm51bGwsImp0aSI6IjEzNjljNjAwLWUwYTEtNDUyNS1hN2M3LTU2YmU3ZDgxM2Y1MSJ9.SeLETowyDVJCGKGc0wjk4fPMH9pug7C9Yw_7xkI7Fvk
```
You can make changes to test with different users by going to [jwt.io](), and pasting the token above in the editor on that page. You can make changes on the "Decoded" side of the editor and that will be reflected in the token that you can then use to sign your requests, therefore impersonating other users.

Note: The signature key used for the local environment is "secret", which is configured in the tc-message-service/config/default.json

## Making a Request

The following curl command will check if the user has access to the submission 455, fetch a thread, creating the thread if necessary, and provisioning a new user in Discourse if necessary:

```shell
curl -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6WyJhZG1pbmlzdHJhdG9yIl0sImlzcyI6Imh0dHBzOi8vYXBpLnRvcGNvZGVyLWRldi5jb20iLCJoYW5kbGUiOiJtYWdyYXRoZWFuIiwiZXhwIjoxNzY2Mjg5MjQ2LCJ1c2VySWQiOiI0MDAxMTU3OCIsImlhdCI6MTQ1MDkyOTI0NiwiZW1haWwiOm51bGwsImp0aSI6IjEzNjljNjAwLWUwYTEtNDUyNS1hN2M3LTU2YmU3ZDgxM2Y1MSJ9.SeLETowyDVJCGKGc0wjk4fPMH9pug7C9Yw_7xkI7Fvk" "http://localhost:8001/v4/topics?filter=reference%3Dsubmission%26referenceId%3D455"
```
You can also create topic by doing the following:
```shell
curl -X POST -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6WyJhZG1pbmlzdHJhdG9yIl0sImlzcyI6Imh0dHBzOi8vYXBpLnRvcGNvZGVyLWRldi5jb20iLCJoYW5kbGUiOiJtYWdyYXRoZWFuIiwiZXhwIjoxNzY2Mjg5MjQ2LCJ1c2VySWQiOiI0MDAxMTU3OCIsImlhdCI6MTQ1MDkyOTI0NiwiZW1haWwiOm51bGwsImp0aSI6IjEzNjljNjAwLWUwYTEtNDUyNS1hN2M3LTU2YmU3ZDgxM2Y1MSJ9.SeLETowyDVJCGKGc0wjk4fPMH9pug7C9Yw_7xkI7Fvk" -H "Content-Type: application/json" "http://localhost:8001/v4/topics" -d '{"reference":"submission","referenceId":"455","tag":"MESSAGES","title":"Test discussion topic","body":"Create a new topic for the specified entity"}'
```


## Unit tests

Please update test environment configurations in `config/config.json`.

```shell
npm test
```

Then you can check coverage report in coverage folder.

## Postman

You can also verify the service using Postman. For this load files from the local/postman directory into Postman.
