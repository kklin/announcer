const express = require('express');
const querystring = require('querystring');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const {User} = require('../models/user');

const clientId = process.env.MONDAY_CLIENT_ID;
const clientSecret = process.env.MONDAY_CLIENT_SECRET;
const signingSecret = process.env.MONDAY_SIGNING_SECRET;

class Router {
    constructor(usersClient, workerManager) {
        this.usersClient = usersClient;
        this.workerManager = workerManager;

        this.router = express.Router();
        this.router.get('/authorize', this.authorize.bind(this));
        this.router.get('/oauth2/callback', this.oauthCallback.bind(this));
        this.router.post('/subscribe', this.subscribe.bind(this));
        this.router.post('/unsubscribe', this.unsubscribe.bind(this));
        this.router.post('/watched-posts-updated', this.boardUpdated.bind(this));
    };

    async authorize(req, res) {
        const { token } = req.query;
        return res.redirect('https://auth.monday.com/oauth2/authorize?' +
            querystring.stringify({
                client_id: clientId,
                state: token
            })
        );
    }

    async oauthCallback(req, res) {
        const { code, state } = req.query;
        const { userId, accountId, backToUrl } = jwt.verify(state, signingSecret);

        // Get access token
        const exchangeResp = await axios.request({
            url: 'https://auth.monday.com/oauth2/token',
            method: 'post',
            responseType: 'json',
            data: {
                grant_type: 'authorization_code',
                code: code,
                client_id: clientId,
                client_secret: clientSecret,
            },
        });

        if (exchangeResp.status != 200) {
            throw new Error('non 200 response');
        }

        if (!exchangeResp.data || !exchangeResp.data.access_token) {
            throw new Error('no access token');
        }

        await this.usersClient.addUser(userId, exchangeResp.data.access_token);

        // Redirect back to monday
        return res.redirect(backToUrl);
    }

    async subscribe(req, res) {
        let { authorization } = req.headers;
        if (!authorization) {
            return res.status(500).json({ error: 'missing authentication' });
        }

        const { userId } = jwt.verify(authorization, signingSecret);

        const subscriptionId = req.body.payload.subscriptionId;
        const postsBoardId = req.body.payload.inputFields.postsBoardId;
        const commentsBoardId = req.body.payload.inputFields.commentsBoardId;
        const webhookUrl = req.body.payload.webhookUrl;

        await this.usersClient.addSubscription(userId, subscriptionId, postsBoardId, commentsBoardId);

        try {
            const user = await this.usersClient.getUser(userId, subscriptionId);
            this.workerManager.processImmediately(user);
        } catch (err) {
            // Even if this fails, we've already added the subscription to our
            // database so we shouldn't error out, or else Monday's state and
            // our state will get out of sync.
            console.log("Failed to queue new subscription", err);
        }

        return res.status(200).send({
            webhookId: subscriptionId,
        });
    }

    async unsubscribe(req, res) {
        // Verify the request.
        let { authorization } = req.headers;
        if (!authorization) {
            return res.status(500).json({ error: 'missing authentication' });
        }

        const { userId } = jwt.verify(authorization, signingSecret);

        const webhookId = req.body.payload.webhookId;
        await this.usersClient.removeSubscription(userId, webhookId);

        return res.status(200).send();
    }

    async boardUpdated(req, res) {
        if (!req || !req.body) {
            return;
        }

        // If it's a challenge from adding the webhook, respond to it.
        if (req.body.challenge) {
            return res.status(200).json({
                challenge: req.body.challenge,
            });
        }

        // Trigger a refresh for the appropriate user.
        if (!req.body.event || !req.body.event.userId || !req.body.event.boardId) {
            return;
        }
        const userId = req.body.event.userId;
        const boardId = req.body.event.boardId;
        this.usersClient.invalidateWatchedPosts(boardId);
        this.usersClient.getRawUser(userId).then((user) => {
            user.subscriptions.forEach((sub) => {
                if (sub.postsBoardId != boardId) {
                    return;
                }

                this.workerManager.processImmediately(new User(
                    this.usersClient.mondayClient, userId, user.mondayAccessToken,
                    sub.postsBoardId, sub.commentsBoardId,
                ));
            });
        });

        return res.status(200).send();
    }
}

module.exports = {
    Router,
};
