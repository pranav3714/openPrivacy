# flush-buffer

Buffer that will flush based on time or number of items added

## Installation

This module is installed via npm:

	$ npm install flush-buffer


## Examples

	const buffer = new FlushBuffer({flushInterval: 10, maxItems: 1});
	buffer.add('bla');
	buffer.on('flush', (data) => {
		console.log(data[0]); // bla
	});
