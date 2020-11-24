const {Cache, CacheKey} = require('./cache');
const mondaySdk = require('monday-sdk-js');
const monday = mondaySdk();

class MondayClient {
    constructor(token) {
        this.cache = new Cache();
    }

    async getItems(token, boardId) {
        return this.cache.get(
            new CacheKey(token, boardId, 'item'),
            async () => {
                const getResp = await mondayApi(`
                    query GetItems($boardId: Int){
                        boards (ids: [$boardId]) {
                            items {
                                name
                                id
                                group {
                                    id
                                    title
                                }
                                column_values {
                                    value
                                    id
                                }
                            }
                        }
                    }
                `, {
                    token: token,
                    variables: {
                        boardId,
                    },
                });

                // We could store the raw GraphQL response in the local cache,
                // but transforming the column values into a parsed dictionary
                // makes it easier for other operations to manipulate the
                // cache.
                getResp.data.boards[0].items.forEach((item) => {
                    const columnsMap = {};
                    item.column_values.forEach((val) => {
                        columnsMap[val.id] = JSON.parse(val.value);
                    });
                    item.column_values = columnsMap;
                });
                return getResp.data.boards[0].items;
            },
        );
    }

    async updateItem(token, boardId, oldItem, newItem, opts) {
        const toCompare = opts.canChange || Object.keys(newItem.column_values);
        for (const key of toCompare) {
            const newValue = newItem.column_values[key];
            // XXX: This comparison only works for non-object types, but that's ok
            // for now since the only field we're changing is "Upvotes". However,
            // if we wanted to change a complex field such as "Date" or "URL",
            // in the future, this check would need to be extended to properly
            // compare object types.
            if (oldItem.column_values[key] != newValue) {
                await this.updateItemColumn(token, boardId, oldItem.id, key, newValue);
            }
        }
        newItem.id = oldItem.id;
        this.cache.updateCollectionItem(
            new CacheKey(token, boardId, 'item'),
            (item) => item.id == oldItem.id,
            newItem);
    }

    async updateItemColumn(token, boardId, itemId, columnId, value) {
        const resp = await mondayApi(`
            mutation UpdateColumnValue(
                $boardId: Int!,
                $itemId: Int!,
                $columnId: String!,
                $value: JSON!
            ) {
                change_column_value(
                    board_id: $boardId,
                    item_id: $itemId,
                    column_id: $columnId,
                    value: $value
                ) {
                    id
                }
            }
        `, {
            token: token,
            variables: {
                boardId,
                itemId,
                columnId,
                'value': JSON.stringify(value),
            },
        });
    }

    async addItem(token, boardId, item) {
        const createResp = await mondayApi(`
            mutation CreateItem($boardId: Int!, $groupId: String, $name: String, $values: JSON) {
                create_item(
                    board_id: $boardId
                    group_id: $groupId
                    item_name: $name
                    column_values: $values
                ) {
                    id
                }
            }
        `, {
            token: token,
            variables: {
                boardId: boardId,
                groupId: item.group.id,
                name:    item.name,
                values:  JSON.stringify(item.column_values),
            },
        });

        item.id = createResp.data.create_item.id;
        this.cache.addCollectionItem(
            new CacheKey(token, boardId, 'item'),
            item);
    }

    async createGroup(token, boardId, name) {
        const resp = await mondayApi(`
            mutation CreateGroup($boardId: Int!, $groupName: String!) {
                create_group(board_id: $boardId, group_name: $groupName) {
                    id
                }
            }`, {
            token: token,
            variables: {
                boardId: boardId,
                groupName: name,
            },
        });
        const id = resp.data.create_group.id
        this.cache.addCollectionItem(
            new CacheKey(token, boardId, 'group'),
            {title: name, id: id});
        return id;
    }

    async getGroups(token, boardId) {
        return this.cache.get(
            new CacheKey(token, boardId, 'group'),
            async () => {
                const groupsResp = await mondayApi(`
                    query Groups($boardId: Int) {
                        boards (ids: [$boardId]) {
                            groups {
                                title
                                id
                            }
                        }
                    }
                `, {
                    token: token,
                    variables: {
                        boardId: boardId,
                    },
                });
                return groupsResp.data.boards[0].groups;
            },
        );
    }
}

async function mondayApi(req, opts) {
    const resp = await monday.api(req, opts);
    if (resp.errors && resp.errors.length != 0) {
        throw new Error(JSON.stringify(resp));
    }
    if (resp.error_code || resp.error_message) {
        throw new Error(JSON.stringify(resp));
    }
    return resp;
}

module.exports = {
    MondayClient,
};
