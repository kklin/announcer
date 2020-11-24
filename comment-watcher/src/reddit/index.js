const snoowrap = require('snoowrap');
const {Comment} = require('../models/comment');

const r = new snoowrap({
    userAgent: 'comment-watcher',
    clientId: process.env.REDDIT_CLIENT_ID,
    clientSecret: process.env.REDDIT_CLIENT_SECRET,
    username: process.env.REDDIT_USERNAME,
    password: process.env.REDDIT_PASSWORD,
});

async function getComments(postUrl) {
    const postUuid = getPostUuid(postUrl);
    const post = await r.getSubmission(postUuid).expandReplies({limit: Infinity, depth: Infinity});
    return parseCommentsListing(post.comments);
}

function parseCommentsListing(comments) {
    let all = [];
    comments.forEach((raw) => {
        // Add parents before children so that children will be able to
        // find the parent's ID in Monday.
        const parsed = new Comment({
            url: `https://reddit.com${raw.permalink}`,
            upvotes: raw.score,
            date: new Date(raw.created_utc * 1000),
            message: raw.body,
            author: emptyGuard(raw.author, author => author.name),
        });
        all.push(parsed);

        const children = parseCommentsListing(raw.replies);
        children.forEach((child) => {
            // Don't set the parent URL for grandchildren.
            if (!child.parentUrl) {
                child.parentUrl = parsed.url;
            }
        });
        all.push.apply(all, children);
    });
    return all;
}

function getPostUuid(url) {
    const uuidRegex = /\/comments\/(?<id>\w+)(?:\/|$)/;
    const matches = url.match(uuidRegex).groups;
    return matches['id'];
}

function emptyGuard(obj, fn) {
    if (!obj) {
        return undefined;
    }
    return fn(obj);
}

module.exports = {
    getComments,
};
