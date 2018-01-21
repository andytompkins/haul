class RequestQueue {
  constructor() {
    this._queue = [];
  }

  addItem(item) {
    const id = this._queue.push(item);
    return id - 1; // return the index of pushed element
  }

  getSpecific(ID) {
    const itemRemoved = this._queue[ID];
    this._queue.splice(ID, 1);
    return itemRemoved;
  }

  flushQueue(callback) {
    this._queue.forEach(callback);
    this._queue.length = 0;
  }
}

module.exports = RequestQueue;
