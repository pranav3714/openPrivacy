const clust = require("cluster"),
	osCPUs = require("os").cpus().length
if (clust.isMaster) {
	for (let i = 0; i < osCPUs; i++) {
		clust.fork()
	}
	clust.on("exit", function () {
		proc = clust.fork()
	})
}
else {
	require("./app")
}
