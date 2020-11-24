import React from "react";
import "./App.css";
import mondaySdk from "monday-sdk-js";
const monday = mondaySdk();

const fetchingComments = "Fetching Comments";
const fetchedComments = "Fetched Comments";

class App extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            fetchStatus: fetchingComments,
        };
    }

    componentDidMount() {
        monday.listen("context", async ctx => {
            if (!ctx.data.boardIds || ctx.data.boardIds.length !== 1 || !ctx.data.itemId) {
                return;
            }

            const boardId = ctx.data.boardIds[0];
            const itemId = ctx.data.itemId;
            this.setState({
                comments: await getThread(boardId, itemId),
                fetchStatus: fetchedComments,
            });
        })
    }

    render() {
        if (this.state.fetchStatus === fetchingComments) {
            return <div className="App">Fetching..</div>;
        }
        return (
            <div>
                {
                this.state.comments.map(comment => (
                    <div className="comment">
                        <p className="message">{comment.message}</p>
                        <div className="meta">
                            <span className="author">{comment.author}</span><br/>
                            <span className="date">{comment.date.toLocaleString()}</span>
                        </div>
                    </div>
                ))
                }
            </div>
        );
    }
}

async function getThread(boardId, itemId) {
    const itemResp = await monday.api(`
        query ($boardId: Int, $itemId: Int) {
            boards (ids: [$boardId]) {
                items (ids: [$itemId], limit: 1) {
                    name
                    column_values {
                        title
                        value
                    }
                }
            }
        }`, { variables: { boardId, itemId } });
    if (!itemResp || !itemResp.data || !itemResp.data.boards ||
        itemResp.data.boards.length !== 1 || !itemResp.data.boards[0].items ||
        itemResp.data.boards[0].items.length !== 1) {
        return undefined;
    }

    const item = itemResp.data.boards[0].items[0];
    const columnValues = {};
    item.column_values.forEach((val) => {
        columnValues[val.title] = JSON.parse(val.value);
    });

    const comment = {
        "message": item['name'],
        "upvotes": columnValues['Upvotes'],
        "date": emptyGuard(columnValues['Date'], parseMondayDate),
        "url": emptyGuard(columnValues['Link'], link => link.url),
        "author": columnValues['Author'],
    };

    const parentId = emptyGuard(columnValues['Parent'], parseLinkedItem);
    if (!parentId) {
        return [comment];
    }

    const parents = await getThread(boardId, parentId);
    parents.push(comment);
    return parents;
}

function emptyGuard(obj, fn) {
    if (!obj) {
        return undefined;
    }
    return fn(obj);
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

function parseLinkedItem(link) {
    if (link.linkedPulseIds && link.linkedPulseIds.length === 1) {
        return link.linkedPulseIds[0].linkedPulseId;
    }
    return undefined;
}

export default App;
