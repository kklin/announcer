const async = require('async');
const reddit = require('../reddit');

class WorkerManager {
    constructor(usersStore) {
        // XXX: Limit concurrency to one to avoid concurrent processing of the same
        // user.
        this.workQueue = new async.priorityQueue(this.processUser, 1);
        this.usersStore = usersStore;
    }

    async run() {
        while (true) {
            console.log('Starting update for all users');

            const users = await this.usersStore.getAllUsers();
            if (users.length > 0) {
                this.workQueue.push(users, 100);
                await this.workQueue.drain();
            }

            console.log('Finished update for all users');
            // Sleep for two minutes.
            await new Promise(resolve => setTimeout(resolve, 2 * 60 * 1000));
        }
    }

    processImmediately(user) {
        this.workQueue.push(user, 0);
    }

    async processUser(user) {
        console.log('Processing user', user.id);

        try {
            let comments = [];
            const watchedPosts = await user.getWatchedPosts();
            for (const post of watchedPosts) {
                const postComments = await reddit.getComments(post.url);
                postComments.forEach((c) => {
                    c.postId = post.itemId;
                    c.owners = post.owners;
                    c.groupTitle = post.group.title;
                });
                comments = comments.concat(postComments);
            }

            const currMondayComments = await user.getComments();

            const changes = joinComments(comments, currMondayComments);
            for (const comment of changes.toAdd) {
                await user.addComment(comment);
            }

            for (const updateOp of changes.toUpdate) {
                await user.updateComment(updateOp.oldComment, updateOp.newComment);
            }

            console.log('Successfully processed user', user.id);
        } catch (err) {
            console.log('Error while processing user', user.id, err);
        }

    }
}

function joinComments(exp, actual) {
    const actualMap = new Map();
    actual.forEach((comment) => {
        actualMap.set(comment.url, comment);
    });

    const joinResult = {
        toUpdate: [],
        toAdd: [],
    };
    exp.forEach((comment) => {
        const curr = actualMap.get(comment.url);
        if (curr == undefined) {
            joinResult.toAdd.push(comment);

        // Reddit fuzzes the comment numbers so we can't do an exact comparison.
        // This also keeps us from hitting the Monday API too much.
        } else if (Math.abs(curr.upvotes - comment.upvotes) > 5) {
            joinResult.toUpdate.push({
                oldComment: curr,
                newComment: comment,
            });
        }
    });

    return joinResult;
}

module.exports = {
    WorkerManager,
};
