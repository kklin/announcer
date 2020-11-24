const express = require('express');
const dotenv = require('dotenv').config();
var bodyParser = require('body-parser')
const routes = require('./routes');
const {WorkerManager} = require('./workers');
const {UsersClient} = require('./models/user');

(async () => {
    const usersClient = new UsersClient();
    await usersClient.init();

    const workerManager = new WorkerManager(usersClient);
    workerManager.run();

    const router = new routes.Router(usersClient, workerManager);

    const app = express();
    const port = process.env.PORT;
    app.use(bodyParser.json())
    app.use(router.router);
    app.listen(port, () => console.log(`Comment watcher listening at http://localhost:${port}`))
})();
