require('dotenv').config()
const ws = require("ws")
const express = require("express")
const bp = require("body-parser")
const jwt = require('jsonwebtoken')
const app = express()
const MongoClient = require('mongodb').MongoClient
const fs = require('fs')
const fb = require('flush-buffer')
//const net = require('net') remove from node-modules too
const mongo = require('./mongo')
const rsa = require('node-rsa')
const cors = require('cors')
const request = require('request')
//const key = rsa() remove from node-modules too


//Database
const mongourl = "mongodb://localhost:27017/"
const secret = "s3cr3tK3y*"
//Database End
//Global Variables
const publicKeyString = fs.readFileSync('public.key').toString()
let userCount = 0
//Global Variables End

//set the template engine ejs
app.set('view engine', 'ejs')

//middlewares
app.use(express.static('public'))
app.use(bp.json())
app.use(cors())
//middlewares end



//server routes
app.get('/', (req, res) => {
	res.render('index')
})

//app.get('/sock', (req, res) => {
//	res.render('socket')
//})


app.post('/signup', function (req, res) {
	//console.log(req.body)
	if (typeof req.body.password == 'undefined') {
		res.status(400).json({ message: "Invalid Password" })
	}
	if (typeof req.body.name == 'undefined' || typeof req.body.email == 'undefined') {
		res.status(400).json({ message: "Empty Name or Email" })
	}
	mongo.insertUser(req, res)
})

app.post('/signin', function (req, res) {
	//console.log(req.body)
	MongoClient.connect(mongourl, { useUnifiedTopology: true }, function (err, client) {
		//console.log("Connected successfully to server")
		const coll = client.db('auth').collection('users')
		coll.find({ email: req.body.email, password: req.body.password }).toArray(function (err, docs) {
			//console.log("Found the following records")
			//console.log(docs)
			//callback(docs)
			if (docs.length == 0) {
				//console.log(docs)
				res.status(400).json({ msg: "Invalid Credentials" })
				//console.log("Invalid Credentials")
				client.close()
			}
			else {
				//console.log(docs)
				let userData = docs[0]
				if (!userData.isVerified) {
					res.status(200).json({ msg: "Unverified" })
					return
				}
				delete userData.password
				delete userData.checked
				delete userData.isVerified
				delete userData.timestamp
				delete userData._id
				delete userData.dbid
				//userData.msg = "Success"
				jwt.sign(userData, secret, (err, token) => {
					res.status(200).json({ token, msg: "Success" })
					//console.log("Success")
					client.close()
				})
			}
		})
	})
})

app.get("/dashboard", function (req, res) {
	res.render('dashboard')
})
app.post("/auth", function (req, res) {
	//console.log(req.body)
	jwt.verify(req.body.token, secret, (err, authData) => {
		if (err) {
			res.status(400).send({ msg: "Fail" })
		}
		else {
			delete authData.iat
			delete authData.dbid
			fs.readFile('views/dashboard.ejs.actual', (err, data) => {
				authData.html = data.toString()
				res.status(200).send(authData)
			})
		}
	})

})

app.post('/list', function (req, res) {
	jwt.verify(req.body.token, secret, (err, authData) => {
		if (err) {
			res.status(400).send({ msg: "Fail" })
		}
		else {
			delete authData.iat
			mongo.listUserFiles(req, res, authData.email)
		}
	})
})

app.post('/del', function (req, res) {
	jwt.verify(req.body.token, secret, (err, authData) => {
		if (err) {
			res.status(400).send({ msg: "Fail" })
		}
		else {
			delete authData.iat
			mongo.deleteFile(req, res, authData.email, req.body.filename)
		}
	})
})

app.get('/admin', function (req, res) {
	res.render('admin')
})

app.post('/admin/dashboard', (req, res) => {
	console.log(req.body)
	mongo.adminLogin(req.body.username, req.body.password, res)
})

app.get('/emailValidation', function (req, res) {
	res.render('otp')
})

app.post('/emailValidation', function (req, res) {
	console.log(req.body)
	mongo.verifyUser(req.body.email, req.body.otp, res)
})

app.post('/userlist', (req, res) => {
	if(req.body.token != process.env.ADMIN_TOKEN){
		res.status(200).json({status: 'Token error'})
		return
	}
	if(req.body.type == 'getuser'){
		mongo.getUsers(email, res)
	}
	else if(req.body.type == 'deluser'){
		mongo.delUserAndData(email, res)
	}
	else{
		res.status(200).json({error: "Unknown type"})
	}
})
//server routes end

let server = app.listen(3000, function () {
	var host = server.address().address
	var port = server.address().port
	if (host == "::") {
		host = "localhost"
	}
	//console.log("Listening at http://%s:%s", host, port)
})

//websocket
const socket = new ws.Server({ server })
socket.on('connection', function connection(ws) {
	console.log("Got a client!")
	let buffer = new fb({ flushInterval: 2000 })
	buffer.on('flush', (dump) => {
		let buffer = dump
		let namesArray = [], dataArr = []
		//console.log(buffer)
		buffer.forEach(function (data, index) {
			let copy = data
			if (namesArray.indexOf(copy.filename) == -1) {
				namesArray.push(copy.filename)
				delete copy.filename
				//delete copy['filename']
				dataArr.push([copy])
			}
			else {
				delete copy.filename
				dataArr[dataArr.length - 1].push(copy)
			}
		})
		namesArray.forEach(function (data, index) {
			mongo.insertChunks(ws, ws.uniqueid, data, dataArr[index])
		})
	})

	userCount = userCount + 1
	console.log("Active users: " + userCount)
	//console.log(ws)
	ws.on('message', function incoming(message) {
		let msg = JSON.parse(message)
		//console.log(msg)
		if (msg.type == 'opening') {
			ws.uniqueid = msg.email
			//console.log(msg)
			jwt.verify(msg.token, secret, (err, authData) => {
				if (err) {
					ws.close()
				}
				else {
					ws.send(JSON.stringify({ type: 'Status Message', authStatus: 1 }))
				}
			})
		}
		else if (msg.type == 'data') {
			//console.log(msg)
			//If wesocket is not authenticated close the connection
			if (!ws.uniqueid) {
				ws.close()
				return
			}
			if (msg.start) {
				let meta = {}
				meta.type = 'meta'
				meta.filename = msg.name
				meta.size = msg.size
				meta.timestamp = msg.timestamp
				meta.totalParts = msg.totalCount
				mongo.insertMeta(ws, ws.uniqueid, meta)
			}
			if (msg.end) {
				console.log('End Packet')
				///mongo.listUserFiles(ws, ws.uniqueid)
			}
			let get = { filename: msg.name, data: msg.value/*zlib.deflate(msg.value)*/, part: msg.count } // changed
			buffer.add(get)
			//Should be changed after clustering looks like radis is an option
			ws.send(JSON.stringify({ status: 1 }))
		}
		else if (msg.type == 'filereq') {
			if (!ws.uniqueid) {
				ws.close()
				return
			}
			//console.log(msg)
			mongo.sendFile(ws, msg.filename, ws.uniqueid)
		}
	})
	ws.on('close', function () {
		console.log("Lost a client!")
		userCount = userCount - 1
	})
	//ws.send('something');
})
