class CacheKey {
    constructor(token, boardId, type) {
        this.token = token;
        this.boardId = boardId;
        this.type = type;
    }

    string() {
        return `${this.token}-${this.boardId}-${this.type}`;
    }
}

function parseCacheKey(str) {
    const regex = /^(?<token>.+)-(?<boardId>\d+)-(?<type>.+)$/;
    const matches = str.match(regex).groups;
    if (!matches || !matches['token'] || !matches['boardId'] || !matches['type']) {
        throw new Error(`malformed key: ${str}`);
    }
    return new CacheKey(matches['token'], parseInt(matches['boardId']), matches['type']);
}

class Cache {
    constructor(opts = {}) {
        this.cache = new Map();
        // How long cache entries are valid for, in milliseconds.
        this.cacheTTL = opts.cacheTTL || 5 * 60 * 1000;
    }

    async get(key, getFn, cacheTTL) {
        const entry = this.cache.get(key.string());
        if (entry != undefined && new Date() < entry.expiration) {
            return entry.val;
        }

        const val = await getFn(key);
        this.set(key, val, cacheTTL);
        return val;
    }

    updateCollectionItem(key, isMatchingChecker, val) {
        const entry = this.cache.get(key.string());
        if (entry == undefined) {
            return;
        }

        if (!Array.isArray(entry.val)) {
            throw new Error('updateCollectionItem called on non-Array cache entry');
        }

        const newEntryVal = [val];
        entry.val.forEach((item) => {
            if (isMatchingChecker(item)) {
                return;
            }
            newEntryVal.push(item);
        });

        entry.val = newEntryVal;
        this.cache.set(key.string(), entry);
    }

    addCollectionItem(key, val) {
        const entry = this.cache.get(key.string());
        if (entry == undefined) {
            return;
        }

        if (!Array.isArray(entry.val)) {
            throw new Error('addCollectionItem called on non-Array cache entry');
        }

        entry.val.push(val);
        this.cache.set(key.string(), entry);
    }

    set(key, val, cacheTTL) {
        if (!cacheTTL) {
            cacheTTL = this.cacheTTL;
        }

        const now = new Date();
        const expiration = new Date(now.getTime() + cacheTTL);
        this.cache.set(key.string(), {expiration, val});
    }
}

module.exports = {
    Cache,
    CacheKey,
    parseCacheKey,
};
