const columnMappings = {
    'upvotes': 'numbers',
    'date': 'date',
    'status': 'status',
    'owners': 'person',
    'postId': 'posts_1',
    'url': 'link9',
    'parentId': 'connect_boards5',
    'author': 'text3',
};

class Comment {
    constructor(opts = {}) {
        this.id = parseInt(opts.id);
        this.url = opts.url;
        this.groupId = opts.groupId;
        this.groupTitle = opts.groupTitle;
        this.upvotes = opts.upvotes;
        this.date = opts.date;
        this.message = truncateString(opts.message);
        this.postId = opts.postId;
        this.status = opts.status;
        this.owners = opts.owners;
        this.parentId = opts.parentId;
        this.author = opts.author;
    }

    toMondayObject() {
        return {
            'name': this.message,
            'id': this.id,
            'group': {
                'id': this.groupId,
            },
            'column_values': {
                [columnMappings['upvotes']]: this.upvotes,
                [columnMappings['date']]: emptyGuard(this.date, toMondayDate),
                [columnMappings['status']]: emptyGuard(this.status, toMondayStatus),
                [columnMappings['owners']]: this.owners,
                [columnMappings['postId']]: emptyGuard(this.postId, (id) => { return {item_ids: [id]} }),
                [columnMappings['url']]: {
                    'url': this.url,
                    'text': 'View',
                },
                [columnMappings['parentId']]: emptyGuard(this.parentId, (id) => { return {item_ids: [id]} }),
                [columnMappings['author']]: this.author,
            },
        };
    }
}

function truncateString(str) {
    if (str.length > 255) {
        return str.substring(0, 251) + ' ...';
    }
    return str;
}

function parseComment(item) {
    return new Comment({
        message: item.name,
        id: item.id,
        groupId: item.group.id,
        upvotes: item.column_values[columnMappings['upvotes']],
        author: item.column_values[columnMappings['author']],
        date: emptyGuard(item.column_values[columnMappings['date']], parseMondayDate),
        status: emptyGuard(item.column_values[columnMappings['status']], parseMondayStatus),
        owners: item.column_values[columnMappings['owners']],
        url: emptyGuard(item.column_values[columnMappings['url']], (link) => link.url),
        parentId: emptyGuard(item.column_values[columnMappings['parentId']], parseLinkedItem),
        postId: emptyGuard(item.column_values[columnMappings['postId']], parseLinkedItem),
    });
}

function parseLinkedItem(link) {
    if (link.linkedPulseIds && link.linkedPulseIds.length == 1) {
        return link.linkedPulseIds[0].linkedPulseId;
    }
    return undefined;
}

function parseMondayDate(mondayDate) {
    let dateStr = mondayDate.date;
    if (mondayDate.time) {
        dateStr += 'T' + mondayDate.time;
    }
    // Monday stores all dates and times in UTC.
    dateStr += 'Z';
    return new Date(dateStr);
}

function toMondayDate(date) {
    return {
        date: [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getDate()].map(padZeros).join('-'),
        time: [date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()].map(padZeros).join(':'),
    };
}

function parseMondayStatus(status) {
    return status.label;
}

function toMondayStatus(status) {
    return {label: status};
}

function emptyGuard(obj, fn) {
    if (!obj) {
        return undefined;
    }
    return fn(obj);
}

function padZeros(num) {
    const str = num.toString();
    if (str.length == 1) {
        return '0' + str;
    }
    return str;
}

module.exports = {
    Comment,
    parseComment,
    columnMappings,
};
