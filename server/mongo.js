require('dotenv').config()
const MongoClient = require('mongodb').MongoClient
const fs = require('fs')
const sgMail = require('@sendgrid/mail')
sgMail.setApiKey(process.env.SEND_GRID);

const url = "mongodb://localhost:27017/"
//ID maker xport
exports.makeid = function (length) {
	var result = '';
	var characters = 'abcdefghijklmnopqrstuvwxyz';
	var charactersLength = characters.length;
	for (var i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	return result;
}
//ID maker xport

let makeidInternal = function (length) {
	var result = '';
	var characters = 'abcdefghijklmnopqrstuvwxyz';
	var charactersLength = characters.length;
	for (var i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	return result;
}

let sendEmail = function (message, recepiant) {
	var email = {
		from: 'support@localhost.com',
		to: recepiant,
		subject: 'Email Verification',
		html: message
	};
	sgMail.send(email)
}

exports.insertUser = function (req, res) {
	let msg
	MongoClient.connect(url, { useUnifiedTopology: true }, function (err, client) {
		const coll = client.db('auth').collection('users')
		coll.find({ email: req.body.email }).toArray(function (err, docs) {
			if (docs.length == 0) {
				//console.log(docs)
				let myobj = req.body
				myobj.createdAt = new Date()
				myobj.timestamp = Math.floor(Date.now())
				myobj.isVerified = false
				myobj.otp = makeidInternal(9)
				emsg = `<h1>You otp is ${myobj.otp}</h1><br><p>Valid only for one hour</p>`
				myobj.dbid = makeidInternal(30)
				coll.insertOne(myobj, function () {
					sendEmail(emsg, myobj.email)
					client.close()
				})
				res.status(200).json({ msg: "Success" })

			}
			else {
				//console.log(docs)
				res.status(200).json({ msg: "User Exists" })
				client.close()
			}
		})
	})
}

exports.verifyUser = function (uemail, uotp, res) {
	MongoClient.connect(url, { useUnifiedTopology: true }, function (err, client) {
		const coll = client.db('auth').collection('users')
		coll.find({ email: uemail, otp: uotp }).toArray(function (err, docs) {
			if (docs.length == 0) {
				client.close()
				res.status(200).json({ msg: "Invalid OTP" })
				return
			}
			coll.updateOne({ email: uemail }, { $set: { isVerified: true }, $unset: { createdAt: "", otp: "" } }, function (err) {
				if (err) {
					res.status(200).json({ msg: "Internal Error" })
					client.close()
					return
				}
				res.status(200).json({ msg: "Verification success login now!" })
				client.close()
			})
		})
	})
}

exports.insertMeta = function (ws, wsemail, metaData) {
	MongoClient.connect(url, { useUnifiedTopology: true }, function (err, client) {
		let coll = client.db('auth').collection("users")
		coll.findOne({ email: wsemail }, function (err, result) {
			if (err) {
				client.close()
				ws.send(JSON.stringify({ status: 0 }))
			}
			else if (result == {}) {
				client.close()
				ws.send(JSON.stringify({ status: 0 }))
			}
			else {
				//console.log(result)
				coll = client.db(result.dbid).collection(makeidInternal(60))
				coll.insertOne(metaData, function (err, res) {
					//console.log(err)
					//console.log(res)
					client.close()
					ws.send(JSON.stringify({ status: 1, method: "Insert Meta" }))
				})
			}
		})
	})
}

exports.insertChunks = function (ws, wsemail, filename, chunkArray) {
	MongoClient.connect(url, { useUnifiedTopology: true }, function (err, client) {
		let coll = client.db('auth').collection("users")
		coll.findOne({ email: wsemail }, function (err, result) {
			if (err) {
				client.close()
				ws.send(JSON.stringify({ status: 0 }))
			}
			else if (result == {}) {
				client.close()
				ws.send(JSON.stringify({ status: 0 }))
			}
			else {
				let db
				db = client.db(result.dbid)
				db.listCollections().toArray(function (err, narray) {
					let colnames = []
					narray.forEach(function (colle, index) {
						coll = db.collection(colle.name)
						coll.findOne({ type: 'meta' }, function (err, result) {
							//console.log(result)
							if (result.filename == filename) {
								coll = db.collection(colle.name)
								//console.log(colle.name)
								//console.log(result)
								coll.insertMany(chunkArray, function (err, res) {
									///console.log("Records inserted: "+res.insertedCount)
									client.close()
									ws.send(JSON.stringify({ status: 1 }))
								})

							}
						})
					})
				})
			}
		})
	})
}

exports.listUserFiles = function (req, res, username) {
	let fileInfo = []
	MongoClient.connect(url, { useUnifiedTopology: true }, function (err, client) {
		let col = client.db('auth').collection('users')
		col.findOne({ email: username }, function (err, result) {
			let db = client.db(result.dbid)
			db.listCollections().toArray(function (err, narray) {
				narray.forEach(function (colObj, index) {
					let colname = colObj.name
					col = db.collection(colname)
					col.findOne({ type: 'meta' }, function (err, result) {
						//console.log(result)
						if (err) {
							res.status(400).json({ msg: 'Error' })
						}
						//console.log(result)
						let newObj = {}
						newObj.filename = result.filename
						newObj.size = result.size
						var d = new Date(result.timestamp)
						newObj.timestamp = d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear()
						fileInfo.push(newObj)
						//ws.send(newObj)
					})
				})
				client.close()
				setTimeout(function () {
					res.status(200).json(fileInfo)
				}, 100)
			})
		})
	})
}

exports.sendFile = function (socket, filenamee, emaile) {
	let fileInfo = []
	MongoClient.connect(url, { useUnifiedTopology: true }, function (err, client) {
		let col = client.db('auth').collection('users')
		//console.log(emaile)
		col.findOne({ email: emaile }, function (err, result) {
			let db = client.db(result.dbid)
			let counter = 500
			db.listCollections().toArray(function (err, narray) {
				narray.forEach(function (colObj, index) {
					let colname = colObj.name
					col = db.collection(colname)
					col.findOne({ type: 'meta' }, function (err, result) {
						if (err) {
							console.log(err)
							return
						}
						if (result.filename == filenamee) {
							let col = db.collection(colObj.name)
							let cursor = col.find({ type: null })
							cursor.each((err, doc) => {
								if (doc == null) {
									//**sock.sendEndMessage({type: 'message', data: 'data:application/octet-stream;base64'})
									//socket.end()
									client.close()
									return
								}
								else {
									delete doc._id
									doc.type = 'chunk'
									doc.filename = filenamee
									doc.totalParts = result.totalParts
									//doc.data = zlib.inflateSync(doc.data.buffer).toString() // changed
									//doc.signature = keypair.sign(doc.data,'base64')
									socket.send(JSON.stringify(doc))
									//console.log(doc)
								}
							})
						}
					})
				})
			})
		})
	})
}

exports.deleteFile = function (req, res, semail, filename) {
	MongoClient.connect(url, { useUnifiedTopology: true }, function (err, client) {
		let coll = client.db('auth').collection("users")
		coll.findOne({ email: semail }, function (err, result) {
			if (err) {
				client.close()
				ws.send(JSON.stringify({ status: 0 }))
			}
			else if (result == {}) {
				client.close()
				ws.send(JSON.stringify({ status: 0 }))
			}
			else {
				let db
				db = client.db(result.dbid)
				db.listCollections().toArray(function (err, narray) {
					let colnames = []
					narray.forEach(function (colle, index) {
						coll = db.collection(colle.name)
						coll.findOne({ type: 'meta' }, function (err, result) {
							//console.log(result)
							if (result.filename == filename) {
								coll = db.collection(colle.name)
								//console.log(colle.name)
								//console.log(result)
								coll.drop(function (err, delOK) {
									client.close()
									res.status(200).json({ status: 1 })
								})
							}
						})
					})
				})
			}
		})
	})
}

exports.adminLogin = function (username, password, res, userCount) {
	const dash = fs.readFileSync('views/admindash.ejs').toString()
	MongoClient.connect(url, { useUnifiedTopology: true }, function (err, client) {
		//console.log("Connected successfully to server")
		const coll = client.db('auth').collection('admins')
		coll.find({ username: username, password: password }).toArray(function (err, docs) {
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
				delete userData._id
				delete userData.password
				userData.msg = "Success"
				res.status(200).send({ html: dash, userCount })
			}
		})
	})
}

exports.userCount = function () {
	MongoClient.connect(url, { useUnifiedTopology: true }, function (err, client) {
		const coll = client.db('auth').collection('users')
		coll.find({ isVerified: true }).count(function (e, count) {
			console.log(count)
		})
	})
}