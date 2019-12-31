//const net = require('net')
const request = require('request')
const bp = require('body-parser')
const express = require('express')
//const rsa = require('node-rsa')
const fs = require('fs')
const app = express()
//const key = new rsa()
const cors = require('cors')
const dtob = require('data-uri-to-buffer')
const CryptoJS = require('crypto-js')
//const fb = require('flush-buffer')
//const buffer = new fb({flushInterval: 2000})
const ws = require("ws")

let port = 5000

//middlewares
app.use(express.static('public'))
app.use(bp.json())
//app.use(cors())
//middlewares end

//Client routes 
app.get('/', function (req, resp) {
	request('http://127.0.0.1:3000', (err, res, body) => {
		if (err) { return console.log(err) }
		//console.log(res.body)
		resp.status(200).send(res.body)
	})
})

app.get('/dashboard', function (req, resp) {
	request('http://127.0.0.1:3000/dashboard', (err, res, body) => {
		if (err) { return console.log(err) }
		//console.log(res.body)
		resp.status(200).send(res.body)
	})
})

app.get('/emailValidation', (req, resp) => {
	request('http://127.0.0.1:3000/emailValidation', (err, res, body) => {
		if (err) { return console.log(err) }
		//console.log(res.body)
		resp.status(200).send(res.body)
	})
})

app.get('/admin', (req, resp) => {
	request('http://127.0.0.1:3000/admin', (err, res, body) => {
		if (err) { return console.log(err) }
		//console.log(res.body)
		resp.status(200).send(res.body)
	})
})

//Client routes end

let server = app.listen(port, function () {
	console.log("I am on localhost:" + port)
})

const socket = new ws.Server({ server })
socket.on('connection', function connection(ws) {
	ws.on('message', function incoming(message) {
		let json = JSON.parse(message)
		if (json.type == 'chunk') {
			fs.appendFileSync('Downloads/' + json.filename, dtob(json.data))
		}
	})
})