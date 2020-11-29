const {Cache, parseCacheKey} = require('./cache');
const {MondayClient} = require('./monday');
const {MongoClient} = require('mongodb');
const {Comment, parseComment, columnMappings} = require('./comment');

const dbHost = process.env.DB_HOST;
const dbName = process.env.DB_NAME;
const dbUsername = process.env.DB_USERNAME;
const dbPassword = process.env.DB_PASSWORD;
const usersCollectionName = 'users';

class UsersClient {
    constructor() {
        this.dbClient = new MongoClient(
            `mongodb://${dbUsername}:${dbPassword}@${dbHost}:27017/${dbName}`,
            { useUnifiedTopology: true });
        this.mondayClient = new MondayClient();
    }

    async init() {
        await this.dbClient.connect();
    };

    async addUser(id, token) {
        console.log('Add user:', {id});
        const collection = this.dbClient.db(dbName).collection(usersCollectionName);
        const query = { mondayUserId: id };
        const user = await collection.findOne(query);
        if (user) {
            // Update token.
            await collection.updateOne(
                {mondayUserId: id},
                {
                    $set: {
                        mondayAccessToken: token,
                    },
                },
            );
        } else {
            // Add user.
            await collection.insertOne({
                mondayUserId: id,
                mondayAccessToken: token,
            });
        }
    }

    async addSubscription(userId, subscriptionId, postsBoardId, commentsBoardId) {
        console.log('Add subscription:', {userId, subscriptionId, postsBoardId, commentsBoardId});
        const collection = this.dbClient.db(dbName).collection(usersCollectionName);
        await collection.updateOne(
            {mondayUserId: userId},
            {
                $push: {
                    'subscriptions': { subscriptionId, postsBoardId, commentsBoardId },
                },
            },
        );
    }

    async removeSubscription(userId, webhookId) {
        console.log('Remove subscription:', {userId, webhookId});
        const collection = this.dbClient.db(dbName).collection(usersCollectionName);
        collection.updateOne({ mondayUserId: userId },
            {
                $pull: {
                    'subscriptions': {
                        subscriptionId: webhookId,
                    },
                },
            },
        );
    }

    async getAllUsers() {
        const users = [];
        const collection = this.dbClient.db(dbName).collection(usersCollectionName);
        await collection.find({}).forEach((user) => {
            if (user.subscriptions) {
                user.subscriptions.forEach((sub) => {
                    users.push(new User(this.mondayClient, user.mondayUserId,
                        user.mondayAccessToken, sub.postsBoardId, sub.commentsBoardId));
                });
            };
        });
        return users;
    }

    async getRawUser(userId) {
        const collection = this.dbClient.db(dbName).collection(usersCollectionName);
        const user = await collection.findOne({mondayUserId: userId});
        if (!user) {
            throw new Error(`${userId} does not exist in database`);
        }

        return user;
    }

    async getUser(userId, subscriptionId) {
        const user = this.getRawUser(userId);
        for (const sub of user.subscriptions) {
            if (sub.subscriptionId === subscriptionId) {
                return new User(this.mondayClient, userId,
                    user.mondayAccessToken, sub.postsBoardId, sub.commentsBoardId);
            }
        }

        throw new Error(`${userId} doesn't have subscription ${subscriptionId}`);
    }

    invalidateWatchedPosts(boardId) {
        for (const keyStr of this.mondayClient.cache.cache.keys()) {
            const key = parseCacheKey(keyStr);
            if (key.boardId === boardId) {
                this.mondayClient.cache.cache.delete(keyStr);
            }
        }
    }
}

class User {
    constructor(mondayClient, id, token, postsBoardId, commentsBoardId) {
        this.mondayClient = mondayClient;
        this.id = id;
        this.token = token;
        this.postsBoardId = postsBoardId;
        this.commentsBoardId = commentsBoardId;
    }

    async getWatchedPosts() {
        const raw = await this.mondayClient.getItems(this.token, this.postsBoardId, 1 * 60 * 1000);
        return raw.map((item) => {
            return {
                itemName: item.name,
                itemId: parseInt(item.id),
                boardId: this.postsBoardId,
                group: {
                    title: item.group.title,
                },
                owners: item.column_values['author'],
                url: emptyGuard(item.column_values['link9'], (link) => link.url),
            };
        });
    }

    async getComments() {
        const comments = await this.mondayClient.getItems(this.token, this.commentsBoardId);
        return comments.map(parseComment);
    }

    async addComment(comment) {
        // TODO: Have timestamps when logging.
        console.log('Adding comment to Monday', {user: this.id, comment: comment.url});
        const groups = await this.mondayClient.getGroups(this.token, this.commentsBoardId);
        let groupId;
        groups.forEach((g) => {
            if (g.title == comment.groupTitle) {
                groupId = g.id;
            }
        });

        if (groupId == undefined) {
            groupId = await this.mondayClient.createGroup(this.token, this.commentsBoardId, comment.groupTitle);
        }

        if (comment.parentUrl) {
            const comments = await this.getComments();
            const parentComment = comments.filter((c) => c.url == comment.parentUrl);
            if (parentComment.length > 0) {
                comment.parentId = parentComment[0].id;
            }
        }

        comment.groupId = groupId;
        comment.status = "New";
        await this.mondayClient.addItem(this.token, this.commentsBoardId, comment.toMondayObject());
    }

    async updateComment(oldComment, newComment) {
        console.log('Update comment', {user: this.id, id: oldComment.id, comment: newComment.url});
        await this.mondayClient.updateItem(this.token, this.commentsBoardId,
            oldComment.toMondayObject(), newComment.toMondayObject(),
            // Don't change other fields, like the status, since we don't
            // properly parse those from Monday.
            {canChange: [columnMappings['upvotes']]});
    }
}

function emptyGuard(obj, fn) {
    if (!obj) {
        return undefined;
    }
    return fn(obj);
}

module.exports = {
    UsersClient,
    User,
};
