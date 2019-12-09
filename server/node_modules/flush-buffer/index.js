'use strict';

const EventEmitter = require('events');

class FlushBuffer extends EventEmitter {

	constructor({flushInterval, maxItems}) {
		super();
		this.flushInterval = flushInterval || 10000;
		this.maxItems = maxItems || 100;
		this.buffer = [];
		this.flushTimeoutId;
		this.flush();
	}

	add(data) {
		if (data) {
			this.buffer.push(data);
			if (this.buffer.length >= this.maxItems) {
				this.flush();
			}
		}
	}

	get() {
		return this.buffer;
	}

	clear() {
		this.buffer = [];
	}

	stop() {
		clearTimeout(this.flushTimeoutId);
	}

	flush() {
		this.stop();
		this.flushTimeoutId = setTimeout(() => this.flush(), this.flushInterval).unref();

		if (!this.buffer.length) {
			return;
		}

		try {
			this.emit('flush', this.buffer);
		} catch (err) {
			this.emit('error', err);
		}

		this.buffer = [];
	}
}

module.exports = FlushBuffer;
