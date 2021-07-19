# tc-message-service

## Tech Stack

- [Node.js](https://nodejs.org/) v8
- [PostgreSQL](https://www.postgresql.org/)
- [ElasticSearch](https://www.elastic.co/) v6.2
- [Apache Kafka](https://kafka.apache.org/)
- [AWS S3](https://aws.amazon.com/s3/)
- [AWS Dynamodb](https://aws.amazon.com/dynamodb/)

## Local Setup

### Requirements

- [Node.js](https://nodejs.org/en/) v12+
- [Docker](https://www.docker.com/)
- [Docker-Compose](https://docs.docker.com/compose/install/)
- [AWS Account](https://aws.amazon.com/s3/)

### Set up AWS S3 for attachments

1. Open [S3 console](https://s3.console.aws.amazon.com/s3/home)
2. Click `Create bucket` button in right up area.
3. Input `Bucket name` that you config in `.env` file with the env name `AWS_S3_BUCKET` and choose `AWS Region` that you config, then click `Create bucket` in the bottom of page.
4. Enter the bucket you've created, upload a file which name is `test.json` to root dir.(the file will be used in postman)
5. Create a folder with name `directory` and upload a file `local.json` to the `directory` dir.(this will also be used in postman)
6. Create a fold with name `tc-message-service` from the root dir.(this is configured in config `aws.S3.storageDir`)

### Steps to run locally

0. Make sure to use Node v8 by command `node -v`. We recommend using [NVM](https://github.com/nvm-sh/nvm) to quickly switch to the right version:

   ```bash
   nvm use
   ```

1. 📦 Install npm dependencies

   ```bash
   npm install
   ```

2. ⚙ Local config

   - In the `tc-message-service` root directory create `.env` file with the next environment variables. Values for **Auth0 config** should be shared with you on the forum.<br>

      ```bash
      # Auth0 config
      AUTH0_URL=
      AUTH0_AUDIENCE=
      AUTH0_CLIENT_ID=
      AUTH0_CLIENT_SECRET=
      AUTH0_PROXY_SERVER_URL=
      # Aws config
      AWS_S3_BUCKET=
      AWS_ACCESS_KEY_ID=
      AWS_SECRET_ACCESS_KEY=
      AWS_REGION=
      # Locally deployed services (via docker-compose)
      MESSAGES_ES_URL=http://dockerhost:9200
      DB_MASTER_URL=postgres://coder:mysecretpassword@dockerhost:5432/messages
      BUS_API_URL=http://dockerhost:8002/v5
      DYNAMODB_URL=http://dockerhost:8000
      ```

      - Values from this file would be automatically used by many `npm` commands.
      - ⚠️ Never commit this file or its copy to the repository!

   - Set `dockerhost` to point the IP address of Docker. Docker IP address depends on your system. For example if docker is run on IP `127.0.0.1` add a the next line to your `/etc/hosts` file:

      ```
      127.0.0.1       dockerhost
      ```

      Alternatively, you may update `.env` file and replace `dockerhost` with your docker IP address.

3. 🚢 Start docker-compose with services which are required to start this project locally

   ```bash
   npm run services:up
   ```

   Wait until all containers are fully started. As a good indicator, wait until `kafka-client` successfully finished by viewing its logs:

   ```bash
   npm run services:logs -- -f kafka-client
   ```

   <details><summary>Click to see a good logs example</summary>
   <br>

   - you would see:

   ```
   Attaching to tc-kafka-client
   tc-kafka-client  | WARNING: Due to limitations in metric names, topics with a period ('.') or underscore ('_') could collide. To avoid issues it is best to use either, but not both.
   tc-kafka-client  | Created topic connect.notification.project.post.created.
   tc-kafka-client  | WARNING: Due to limitations in metric names, topics with a period ('.') or underscore ('_') could collide. To avoid issues it is best to use either, but not both.
   tc-kafka-client  | Created topic connect.notification.project.post.deleted.
   tc-kafka-client  | WARNING: Due to limitations in metric names, topics with a period ('.') or underscore ('_') could collide. To avoid issues it is best to use either, but not both.
   tc-kafka-client  | Created topic connect.notification.project.post.edited.
   tc-kafka-client  | WARNING: Due to limitations in metric names, topics with a period ('.') or underscore ('_') could collide. To avoid issues it is best to use either, but not both.
   tc-kafka-client  | Created topic connect.notification.project.topic.created.
   tc-kafka-client  | WARNING: Due to limitations in metric names, topics with a period ('.') or underscore ('_') could collide. To avoid issues it is best to use either, but not both.
   tc-kafka-client  | Created topic connect.notification.project.topic.deleted.
   tc-kafka-client  | WARNING: Due to limitations in metric names, topics with a period ('.') or underscore ('_') could collide. To avoid issues it is best to use either, but not both.
   tc-kafka-client  | Created topic connect.notification.project.topic.updated.
   tc-kafka-client exited with code 0
   ```

   </details>

   <br>
   If you want to learn more about docker-compose configuration
   <details><summary>see more details here</summary>
   <br>

   This docker-compose file starts the next services:
   | Service                                                                     |       Name        | Port  |
   | --------------------------------------------------------------------------- | :---------------: | :---: |
   | PostgreSQL                                                                  |     postgres      | 5432  |
   | Elasticsearch                                                               |   elasticsearch   | 9200  |
   | Zookeeper                                                                   |     zookeeper     | 2181  |
   | Kafka                                                                       |       kafka       | 9092  |
   | mock-services                                                               |  mock-service     | 3001  |
   | [tc-bus-api](https://github.com/topcoder-platform/tc-bus-api)               |    tc-bus-api     | 8002  |
   | [dynamodb](https://aws.amazon.com/dynamodb/)                                |    dynamodb       | 8000  |

   - as many of the Topcoder services in this docker-compose require Auth0 configuration for M2M calls, our docker-compose file passes environment variables `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_URL`, `AUTH0_AUDIENCE`, `AUTH0_PROXY_SERVER_URL` to its containers. docker-compose takes them from `.env` file if provided.

   - `docker-compose` automatically would create Kafka topics which are used by this project listed in `local/kafka-client/topics.txt`.

   - To view the logs from any container inside docker-compose use the following command, replacing `SERVICE_NAME` with the corresponding value under the **Name** column in the above table:

     ```bash
     npm run services:log -- -f SERVICE_NAME
     ```

   - If you want to modify the code of any of the services which are run inside this docker-compose file, you can stop such service inside docker-compose by command `docker-compose -f local/docker-compose.yml stop <SERVICE_NAME>` and run the service separately, following its README file.

   </details>

4. ♻ Init DB

   ```bash
   npm run local:init
   ```

   This command will do 3 things:

   - create Database tables (drop if exists)
   - import demo data to Database (clears any existent data if exist)

5. 🚀 Start tc message service

   ```bash
   npm run dev
   ```

   Runs the tc message service using nodemon, so it would be restarted after any of the files is updated.
   The tc message service  will be served on `http://localhost:8001`.

## NPM Commands

| Command | Description                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                                                                                                            | Check for for lint errors.                                                                                                                         |
| `npm run lint:fix`                                                                                                        | Check for for lint errors and fix error automatically when possible.                                                                               |
| `npm run start`                                                                                                           | Start app in the production mode.                                                                                      |
| `npm run start:dev`                                                                                                       | Start app in the development mode using `nodemon`.                                                                                          |
| `npm run test`                                                                                                            | Run tests.                                                                                                                                  |
| `npm run test:watch`                                                                                                      | Run tests and watch.                                                                                        |
| `npm run db:reset`                                                                                                        | Initializes/resets Database.                                                                                                  |
| `npm run data:import <filePath>`                                                                                          | Imports data into ES and db from filePath (`./data/demo-data.json` is used as default). Use `-- --force` flag to skip confirmation                 |
| `npm run data:export <filePath>`                                                                                          | Exports data from ES and db into filePath (`./data/demo-data.json` is used as default). Use `-- --force` flag to skip confirmation                 |
| `npm run services:up`                                                                                                     | Start services via docker-compose for local development.                                                                                           |
| `npm run services:down`                                                                                                   | Stop services via docker-compose for local development.                                                                                            |
| `npm run services:logs -- -f <service_name>`                                                                              | View logs of some service inside docker-compose.                                                                                                   |
| `npm run local:reset`                                                                                                      | Recreate Database and populate demo data for local development (removes any existent data).                              |
| `npm run migrate`                                                                                                         | Run any migration files which haven't run yet.                                                                                                     |
| `npm run migrate:undo`                                                                                                    | Revert most recent migration.                                                                                                                      |
| `npm run clean-attachments`                                                                                          | Clean attachments file in s3                                                                         |

## Import and Export data

### 📤 Export data

To export data to the default file `data/demo-data.json`, run:
```bash
npm run data:export
```

If you want to export data to another file, run:

```bash
npm run data:export -- --file path/to-file.json
```

- List of models that will be exported are defined in `scripts/exportData.js`.

### 📥 Import data

⚠️ This command would clear any existent data in DB before importing.

To import data from the default file `data/demo-data.json`, run:
```bash
npm run data:import
```

If you want to import data from another file, run:

```bash
npm run data:import -- --file path/to-file.json
```

- List of models that will be imported are defined in `scripts/importData.js`.

## Kafka commands

If you've used `docker-compose` with the file `local/docker-compose.yml` during local setup to spawn kafka & zookeeper, you can use the following commands to manipulate kafka topics and messages:
(Replace `TOPIC_NAME` with the name of the desired topic)

### Create Topic

```bash
docker exec tc-message-kafka /opt/kafka/bin/kafka-topics.sh --create --zookeeper zookeeper:2181 --partitions 1 --replication-factor 1 --topic TOPIC_NAME
```

### List Topics

```bash
docker exec tc-message-kafka /opt/kafka/bin/kafka-topics.sh --list --zookeeper zookeeper:2181
```

### Watch Topic

```bash
docker exec tc-message-kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic TOPIC_NAME
```

### Post Message to Topic (from stdin)

```bash
docker exec -it tc-message-kafka /opt/kafka/bin/kafka-console-producer.sh --broker-list localhost:9092 --topic TOPIC_NAME
```

- Enter or copy/paste the message into the console after starting this command.

## DB Migration

- `npm run migrate`: run any migration files which haven't run yet.
- `npm run migrate:undo`: revert most recent migration.

## Testing

- Run `npm run test` to execute unit tests and generate coverage report.
- Run `npm run test:watch` to watch unit tests be executed.

## 📋 Code Guidelines

### Documentation and Utils

When we add, update or delete models and/or endpoints we have to make sure that we keep documentation and utility scripts up to date.

- **Swagger**
  - There is a updated swagger file in `docs/`
- **Postman**
  - There is a updated postman collection in `docs/`
  - Before you execute postman collection you should update `s3_bucket_name` env to your own s3 bucket name.

- **Import/Export**
  - NPM commands `data:import` and `data:export` should support importing/exporting data from/to all the models.
- **DB Migration**
  - If there are any updates in DB schemas, create a DB migration script inside `migrations` folder which would make any necessary updates to the DB schema.
  - Test, that when we migrate DB from the previous state using `npm run migrate`, we get exactly the same DB schema as if we create DB from scratch using command `npm run init-db force`.
)
