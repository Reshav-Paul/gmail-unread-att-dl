const gmailApiAuth = require('./lib/gmail_api_auth');
const FileHelper = require('./lib/file_helper');

const path = require('path');
const atob = require('atob');

String.prototype.replaceAll = function (search, replacement) {
	var target = this;
	return target.split(search).join(replacement);
}

let messageIds = [];
gmailApiAuth.doAuth(main);

function main(auth, gmail) {
	let state = {};

	getUnreadEmailIds(auth, gmail).then(async (mailIds) => {
		console.log(`Got ${messageIds.length} mails. Fetching data...`);
		state.mailIds = mailIds;
		let mails = await getEmailsById(auth, gmail, state.mailIds);
		state.mails = mails;
		state.attachmentData = collectAllAttachmentData(state.mails);
		await fetchAndSaveAllAttachments(auth, gmail, state.attachmentData);
		console.log('Done...');
		console.log('Marking messages as read...');
		await markMessagesAsRead(auth, gmail, state.mailIds);
	});
}

function getUnreadEmailIds(auth, gmail, nextPageToken) {
	return new Promise((resolve, reject) => {
		gmail.users.messages.list({
			auth: auth,
			userId: 'me',
			labelIds: 'UNREAD',
			maxResults: 100,
			pageToken: nextPageToken ? nextPageToken : undefined,
		}, function (err, res) {
			if (err) {
				console.log('The API returned an error: ' + err);
				reject(err);
			}
			if (res.data && res.data.nextPageToken) {
				messageIds = messageIds.concat(res.data.messages);
				resolve(getUnreadEmailIds(auth, gmail, res.data.nextPageToken));
			} else {
				messageIds = messageIds.concat(res.data.messages);
				resolve(messageIds);
			}
		});
	});
}

async function getEmailsById(auth, gmail, mailIds) {
	let results = [];
	let requestQueue = [];
	let counter = 0;
	for (idx in mailIds) {
		if (mailIds[idx]) {
			requestQueue.push(getMail(auth, gmail, mailIds[idx].id));
			counter++;
			if (counter === 100) {
				mails = await Promise.all(requestQueue);
				results = results.concat(mails);
				requestQueue = [];
				counter = 0;
				await sleep(2000);
			}
		}
	}
	mails = await Promise.all(requestQueue);
	results = results.concat(mails);
	requestQueue = [];
	counter = 0;
	return results;
}

function getMail(auth, gmail, mailId) {
	return new Promise((resolve, reject) => {
		gmail.users.messages.get({
			userId: 'me',
			id: mailId,
			auth,
		}, (err, response) => {
			if (err) {
				reject(err);
			}
			resolve(response);
		})
	})
}

function collectAllAttachmentData(mails) {
	return mails.map((m) => {
		if (!m.data || !m.data.payload || !m.data.payload.parts) {
			return undefined;
		}
		return m.data.payload.parts.map((p) => {
			if (!p.body || !p.body.attachmentId) {
				return undefined;
			}
			const attachment = {
				mailId: m.data.id,
				name: p.filename,
				id: p.body.attachmentId
			};
			return attachment;
		});
	}).flat().filter(e => e !== undefined);
}

async function fetchAndSaveAllAttachments(auth, gmail, attachments) {
	let results = [];
	let promises = [];
	let counter = 0;
	for (index in attachments) {
		if (attachments[index].id) {
			promises.push(fetchAndSaveAttachment(auth, gmail, attachments[index]));
			counter++;
			if (counter === 100) {
				attachs = await Promise.all(promises);
				results = results.concat(attachs);
				promises = [];
				counter = 0;
			}
		}
	}
	attachs = await Promise.all(promises);
	results = results.concat(attachs);
	return results;
}

function fetchAndSaveAttachment(auth, gmail, attachment) {
	return new Promise((resolve, reject) => {
		gmail.users.messages.attachments.get({
			auth: auth,
			userId: 'me',
			messageId: attachment.mailId,
			id: attachment.id
		}, function (err, response) {
			if (err) {
				console.log('The API returned an error: ' + err);
				reject(err);
			}
			if (!response) {
				console.log('Empty response: ' + response);
				reject(response);
			}
			let data = response.data.data.replaceAll('-', '+');
			data = data.replaceAll('_', '/');
			let content = fixBase64(data);
			resolve(content);
		});
	})
		.then((content) => {
			console.log('Saving file: ' + attachment.name);
			var fileName = path.resolve(__dirname, 'files', attachment.name);
			return FileHelper.isFileExist(fileName)
				.then((isExist) => {
					if (isExist) {
						return FileHelper.getNewFileName(fileName);
					}
					return fileName;
				})
				.then((availableFileName) => {
					return FileHelper.saveFile(availableFileName, content);
				})
		})
}

async function markMessagesAsRead(auth, gmail, mailIds) {
	let results = [];
	let requestQueue = [];
	let counter = 0;
	for (idx in mailIds) {
		if (mailIds[idx]) {
			requestQueue.push(markAsRead(auth, gmail, mailIds[idx].id));
			counter++;
			if (counter === 100) {
				mails = await Promise.all(requestQueue);
				results = results.concat(mails);
				requestQueue = [];
				counter = 0;
				await sleep(2000);
			}
		}
	}
	mails = await Promise.all(requestQueue);
	results = results.concat(mails);
	requestQueue = [];
	counter = 0;
	return results;
}

function markAsRead(auth, gmail, mailId) {
	return new Promise((resolve, reject) => {
		gmail.users.messages.modify({
			auth,
			userId: 'me',
			id: mailId,
			removeLabelIds: [
				'UNREAD'
			]
		}, function (err, res) {
			if (err) {
				console.log('The API returned an error: ' + err);
				reject(err);
			}
			if (!res) {
				console.log('Empty response: ' + res);
				reject(res);
			}
			resolve(res);
		});
	});
}

function fixBase64(binaryData) {
	const base64str = binaryData;
	const binary = atob(base64str.replace(/\s/g, ''));
	const len = binary.length;
	const buffer = new ArrayBuffer(len);
	const view = new Uint8Array(buffer);

	for (let i = 0; i < len; i++) {
		view[i] = binary.charCodeAt(i);
	}

	return view;
}

function sleep(ms) {
	console.log(`sleeping for ${ms / 1000} s`)
	return new Promise(resolve => setTimeout(resolve, ms));
}
