db.createUser(
        {
            user: 'monday-comments-watcher',
            pwd: 'monday-comments-watcher',
            roles: [
                {
                    role: 'readWrite',
                    db: 'monday-comments-watcher'
                }
            ]
        }
);
db['monday-comments-watcher'].createIndex({mondayUserId: 1}, {unique: true});
