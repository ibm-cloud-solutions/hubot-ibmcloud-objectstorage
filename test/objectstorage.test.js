/*
 * Licensed Materials - Property of IBM
 * (C) Copyright IBM Corp. 2016. All Rights Reserved.
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */
'use strict';

// Passing arrow functions to mocha is discouraged: https://mochajs.org/#arrow-functions
// return promises from mocha tests rather than calling done() - http://tobyho.com/2015/12/16/mocha-with-promises/


/* eslint quote-props:0, quotes:0, indent:0*/

const Helper = require('hubot-test-helper');
const helper = new Helper('../src/scripts');
const expect = require('chai').expect;
// const rewire = require('rewire');
// const objectstorageAPI = rewire('../src/scripts/objectstorage');
const sprinkles = require('mocha-sprinkles');
const nock = require('nock');

const i18n = new (require('i18n-2'))({
	locales: ['en'],
	extension: '.json',
	// Add more languages to the list of locales when the files are created.
	directory: __dirname + '/../src/messages',
	defaultLocale: 'en',
	// Prevent messages file from being overwritten in error conditions (like poor JSON).
	updateFiles: false
});
// At some point we need to toggle this setting based on some user input.
i18n.setLocale('en');

const timeout = 5000;

const HUBOT_OBJECT_STORAGE_AUTH_URL = process.env.HUBOT_OBJECT_STORAGE_AUTH_URL;
const NLC_URL = process.env.VCAP_SERVICES_NATURAL_LANGUAGE_CLASSIFIER_0_CREDENTIALS_URL || process.env.HUBOT_WATSON_NLC_URL;
const FAKE_OBJECT_STORAGE_ENDPOINT = 'http://storestuff.com';
const TEST_CONTAINER = {
	name: 'TestContainer',
	bytes: '1024',
	count: 54
};

const TEST_CONTAINER_OBJECTS = {
	name: 'foo.txt',
	bytes: '1024',
	last_modified: 'yesterday',
	hash: 'ASDFdsfsdf',
	content_type: 'text'
};

const TEST_CONTAINER_ATTACHMENT = {
	"attachments": [{
		"color": "#555",
		"fields": [{
			"short": true,
			"title": "size",
			"value": "1.00K"
		}, {
			"short": true,
			"title": "file count",
			"value": "54"
		}],
		"title": "TestContainer"
	}]
};

const TEST_CONTAINER_OBJECTS_ATTACHMENT = {
	"attachments": [{
		"color": "#555",
		"fields": [{
			"short": true,
			"title": "size",
			"value": "1.00K"
		}, {
			"short": true,
			"title": "last modified",
			"value": "yesterday"
		}, {
			"short": true,
			"title": "content type",
			"value": "text"
		}, {
			"short": true,
			"title": "hash",
			"value": "ASDFdsfsdf"
		}],
		"title": "foo.txt"
	}]
};

function waitForMessageQueue(room, len) {
	return sprinkles.eventually({
		timeout: timeout
	}, function() {
		if (room.messages.length < len) {
			throw new Error('too soon');
		}
	}).then(() => false).catch(() => true).then((success) => {
		// Great.  Move on to tests
		expect(room.messages.length).to.eql(len);
	});
}

describe('Test test via Slack', function() {

	let room;

	before(function() {

	});

	beforeEach(function() {
		room = helper.createRoom();
		// Before all
		nock(HUBOT_OBJECT_STORAGE_AUTH_URL).post('/v3/auth/tokens', {}).reply(200, {
			token: {
				catalog: [{
					type: 'object-store',
					endpoints: [{
						region: 'dallas',
						interface: 'public',
						url: FAKE_OBJECT_STORAGE_ENDPOINT
					}]
				}]
			}
		}, {
			'x-subject-token': 'longrandomstring'
		});
		// Force all emits into a reply.
		room.robot.on('ibmcloud.formatter', function(event) {
			if (event.message) {
				event.response.reply(event.message);
			}
			else {
				event.response.send({
					attachments: event.attachments
				});
			}
		});
	});

	afterEach(function() {
		room.destroy();
	});

	context('user calls `objectstorage container list`', function() {
		beforeEach(function() {
			nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/').query({
				format: 'json'
			}).reply(200, [TEST_CONTAINER]);
			return room.user.say('mimiron', '@hubot objectstorage container list');
		});

		it('should respond with the list of containers', function() {
			return waitForMessageQueue(room, 3).then(() => {
				// Great.  Move on to tests
				expect(room.messages.length).to.eql(3);
				expect(room.messages[1][1]).to.be.a('string');
				expect(room.messages[1][1]).to.equal('@mimiron ' + i18n.__('objectstorage.list.containers'));
				expect(room.messages[2][1]).to.deep.equal(TEST_CONTAINER_ATTACHMENT);
			});
		});
	});

	context('user calls `objectstorage container details containerName`', function() {
		beforeEach(function() {
			nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/').query({
				format: 'json'
			}).reply(200, [TEST_CONTAINER]);
			nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/' + TEST_CONTAINER.name).query({
				format: 'json'
			}).reply(200, [TEST_CONTAINER_OBJECTS]);
			return room.user.say('mimiron', '@hubot objectstorage container details ' + TEST_CONTAINER.name);
		});

		it('should respond with the list of container objects', function() {
			return waitForMessageQueue(room, 3).then(() => {
				// Great.  Move on to tests
				expect(room.messages.length).to.eql(3);
				expect(room.messages[1][1]).to.be.a('string');
				expect(room.messages[1][1]).to.equal('@mimiron ' + i18n.__('objectstorage.list.objects', TEST_CONTAINER.name));
				expect(room.messages[2][1]).to.deep.equal(TEST_CONTAINER_OBJECTS_ATTACHMENT);
			});
		});
	});

	context('user calls `objectstorage retrieve`', function() {
		beforeEach(function() {
			room.robot.adapterName = 'slack';
			nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/').query({
				format: 'json'
			}).reply(200, [TEST_CONTAINER]);
			nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/' + TEST_CONTAINER.name).query({
				format: 'json'
			}).reply(200, [TEST_CONTAINER_OBJECTS]);
			nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/' + TEST_CONTAINER.name + '/' + TEST_CONTAINER_OBJECTS_ATTACHMENT.attachments[
				0].title).query({
				format: 'json'
			}).reply(200, 'This is the text');
			return room.user.say('mimiron', '@hubot objectstorage retrieve');
		});

		it('should retrieve the file and upload to adapter', function() {
			return waitForMessageQueue(room, 2).then(() => {
					return room.user.say('mimiron', '@hubot 1');
				})
				.then(() => {
					return waitForMessageQueue(room, 4);
				})
				.then(() => {
					return room.user.say('mimiron', '@hubot 1');
				})
				.then(() => {
					return waitForMessageQueue(room, 7);
				});
		});
	});

	context('user calls `objectstorage search`', function() {
		beforeEach(function() {
			room.robot.adapterName = 'slack';
		});

		it('should search and upload results to adapter', function(done) {
			nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/').query({
				format: 'json'
			}).reply(200, [TEST_CONTAINER]);
			nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/' + TEST_CONTAINER.name).query({
				format: 'json'
			}).reply(200, [TEST_CONTAINER_OBJECTS]);
			nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/' + TEST_CONTAINER.name + '/' + TEST_CONTAINER_OBJECTS_ATTACHMENT.attachments[
				0].title).query({
				format: 'json'
			}).reply(200, 'This is the text');
			nock(NLC_URL).get('/v1/classifiers').reply(200, {
				classifiers: [{
					"classifier_id": "good",
					"url": "https://foo.com/v1/classifiers/good",
					"name": "cloudbot-obj-storage-classifier",
					"language": "en",
					"created": "2016-08-22T15:08:28.176Z"
				}]
			});

			nock(NLC_URL).get('/v1/classifiers/good').reply(200, {
				"classifier_id": "good",
				"name": "cloudbot-obj-storage-classifier",
				"language": "en",
				"created": "2016-08-22T15:08:28.176Z",
				"url": "https://foo.com/v1/classifiers/good",
				"status": "Available",
				"status_description": "The classifier instance is now available and is ready to take classifier requests."
			});


			nock(NLC_URL).post('/v1/classifiers/good/classify', {
				"text": "ocean with birds"
			}).reply(200, {
				classifier_id: 'good',
				url: 'https://foo.com/v1/classifiers/good',
				text: 'ocean with birds',
				top_class: '/' + TEST_CONTAINER.name + '/' + TEST_CONTAINER_OBJECTS_ATTACHMENT.attachments[0].title,
				classes: [{
					class_name: '/' + TEST_CONTAINER.name + '/' + TEST_CONTAINER_OBJECTS_ATTACHMENT.attachments[0].title,
					confidence: 0.8865453325314453
				}]
			});


			room.user.say('mimiron', '@hubot objectstorage search ocean with birds')
				.then(() => {
					return waitForMessageQueue(room, 3).then(() => {
						expect(room.messages[1]).to.eql(['hubot', '@mimiron ' + i18n.__('objectstore.search.object')]);
						done();
					});
				});
		});

		it('should search and upload results to adapter (2 available classifiers, 1 unauthorized)', function(done) {
			nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/').query({
				format: 'json'
			}).reply(200, [TEST_CONTAINER]);
			nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/' + TEST_CONTAINER.name).query({
				format: 'json'
			}).reply(200, [TEST_CONTAINER_OBJECTS]);
			nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/' + TEST_CONTAINER.name + '/' + TEST_CONTAINER_OBJECTS_ATTACHMENT.attachments[
				0].title).query({
				format: 'json'
			}).reply(200, 'This is the text');
			nock(NLC_URL).get('/v1/classifiers').reply(200, {
				classifiers: [{
					"classifier_id": "good",
					"url": "https://foo.com/v1/classifiers/good",
					"name": "cloudbot-obj-storage-classifier",
					"language": "en",
					"created": "2016-08-22T15:08:28.176Z"
				}, {
					"classifier_id": "worse",
					"url": "https://foo.com/v1/classifiers/good",
					"name": "cloudbot-obj-storage-classifier",
					"language": "en",
					"created": "2016-08-20T15:08:28.176Z"
				}, {
					"classifier_id": "reallybad",
					"url": "https://foo.com/v1/classifiers/good",
					"name": "cloudbot-obj-storage-classifier",
					"language": "en",
					"created": "2016-08-20T15:08:28.176Z"
				}]
			});

			nock(NLC_URL).get('/v1/classifiers/good').reply(200, {
				"classifier_id": "good",
				"name": "cloudbot-obj-storage-classifier",
				"language": "en",
				"created": "2016-08-22T15:08:28.176Z",
				"url": "https://foo.com/v1/classifiers/good",
				"status": "Available",
				"status_description": "The classifier instance is now available and is ready to take classifier requests."
			});

			nock(NLC_URL).get('/v1/classifiers/worse').reply(200, {
				"classifier_id": "good",
				"name": "cloudbot-obj-storage-classifier",
				"language": "en",
				"created": "2016-08-20T15:08:28.176Z",
				"url": "https://foo.com/v1/classifiers/good",
				"status": "Available",
				"status_description": "The classifier instance is now available and is ready to take classifier requests."
			});

			nock(NLC_URL).get('/v1/classifiers/worse').reply(403, {
				"classifier_id": "good",
				"name": "cloudbot-obj-storage-classifier",
				"language": "en",
				"created": "2016-08-20T15:08:28.176Z",
				"url": "https://foo.com/v1/classifiers/good",
				"status": "Available",
				"status_description": "The classifier instance is now available and is ready to take classifier requests."
			});

			nock(NLC_URL).post('/v1/classifiers/good/classify', {
				"text": "ocean with birds"
			}).reply(200, {
				classifier_id: 'good',
				url: 'https://foo.com/v1/classifiers/good',
				text: 'ocean with birds',
				top_class: '/' + TEST_CONTAINER.name + '/' + TEST_CONTAINER_OBJECTS_ATTACHMENT.attachments[0].title,
				classes: [{
					class_name: '/' + TEST_CONTAINER.name + '/' + TEST_CONTAINER_OBJECTS_ATTACHMENT.attachments[0].title,
					confidence: 0.8865453325314453
				}]
			});


			room.user.say('mimiron', '@hubot objectstorage search ocean with birds')
				.then(() => {
					return waitForMessageQueue(room, 3).then(() => {
						expect(room.messages[1]).to.eql(['hubot', '@mimiron ' + i18n.__('objectstore.search.object')]);
						done();
					});
				});
		});

		it('should respond without results (no classifiers)', function(done) {
			nock(NLC_URL).get('/v1/classifiers').reply(200, {
				classifiers: []
			});
			nock(NLC_URL).post('/v1/classifiers/good/classify', {
				"text": "ocean with carts"
			}).reply(200, {});
			room.user.say('mimiron', '@hubot objectstorage search ocean with cats')
				.then(() => {
					return waitForMessageQueue(room, 2).then(() => {
						expect(room.messages[1]).to.eql(['hubot', '@mimiron ' + i18n.__('objectstore.search.object.no.results')]);
						done();
					});
				}).catch((error) => {
					done(error);
				});
		});

		it('should respond without results (classifiers with different name)', function(done) {
			nock(NLC_URL).get('/v1/classifiers').reply(200, {
				classifiers: [{
					"classifier_id": "good",
					"url": "https://foo.com/v1/classifiers/good",
					"name": "foobar",
					"language": "en",
					"created": "2016-08-22T15:08:28.176Z"
				}]
			});

			nock(NLC_URL).get('/v1/classifiers/good').reply(200, {
				"classifier_id": "good",
				"name": "foobar",
				"language": "en",
				"created": "2016-08-22T15:08:28.176Z",
				"url": "https://foo.com/v1/classifiers/good",
				"status": "Available",
				"status_description": "The classifier instance is now available and is ready to take classifier requests."
			});
			nock(NLC_URL).post('/v1/classifiers/good/classify', {
				"text": "ocean with waves"
			}).reply(200, {});
			room.user.say('mimiron', '@hubot objectstorage search ocean with waves')
				.then(() => {
					return waitForMessageQueue(room, 2).then(() => {
						expect(room.messages[1]).to.eql(['hubot', '@mimiron ' + i18n.__('objectstore.search.object.no.results')]);
						done();
					});
				}).catch((error) => {
					done(error);
				});
		});


		it('should respond without results (classifiers with different name)', function(done) {
			nock(NLC_URL).get('/v1/classifiers').reply(403, {});
			room.user.say('mimiron', '@hubot objectstorage search ocean with waves')
				.then(() => {
					return waitForMessageQueue(room, 2).then(() => {
						expect(room.messages[1]).to.eql(['hubot', '@mimiron ' + i18n.__('objectstore.search.object.no.results')]);
						done();
					});
				}).catch((error) => {
					done(error);
				});
		});

		it('should respond without results (classifiers but all training)', function(done) {
			nock(NLC_URL).get('/v1/classifiers').reply(200, {
				classifiers: [{
					"classifier_id": "good",
					"url": "https://foo.com/v1/classifiers/good",
					"name": "cloudbot-obj-storage-classifier",
					"language": "en",
					"created": "2016-08-22T15:08:28.176Z"
				}]
			});

			nock(NLC_URL).get('/v1/classifiers/good').reply(200, {
				"classifier_id": "good",
				"name": "cloudbot-obj-storage-classifier",
				"language": "en",
				"created": "2016-08-22T15:08:28.176Z",
				"url": "https://foo.com/v1/classifiers/good",
				"status": "Available",
				"status_description": "The classifier instance is now available and is ready to take classifier requests."
			});
			nock(NLC_URL).post('/v1/classifiers/good/classify', {
				"text": "ocean with waves"
			}).reply(200, {});
			room.user.say('mimiron', '@hubot objectstorage search ocean with waves')
				.then(() => {
					return waitForMessageQueue(room, 2).then(() => {
						expect(room.messages[1]).to.eql(['hubot', '@mimiron ' + i18n.__('objectstore.search.object.no.results')]);
						done();
					});
				}).catch((error) => {
					done(error);
				});
		});

		it('should respond without results (classifiers missing object storage file)', function(done) {
			nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/').query({
				format: 'json'
			}).reply(200, [TEST_CONTAINER]);
			nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/' + TEST_CONTAINER.name).query({
				format: 'json'
			}).reply(200, [TEST_CONTAINER_OBJECTS]);
			nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/' + TEST_CONTAINER.name + '/' + TEST_CONTAINER_OBJECTS_ATTACHMENT.attachments[
				0].title).query({
				format: 'json'
			}).reply(404);
			nock(NLC_URL).get('/v1/classifiers').reply(200, {
				classifiers: [{
					"classifier_id": "good",
					"url": "https://foo.com/v1/classifiers/good",
					"name": "cloudbot-obj-storage-classifier",
					"language": "en",
					"created": "2016-08-22T15:08:28.176Z"
				}]
			});

			nock(NLC_URL).get('/v1/classifiers/good').reply(200, {
				"classifier_id": "good",
				"name": "cloudbot-obj-storage-classifier",
				"language": "en",
				"created": "2016-08-22T15:08:28.176Z",
				"url": "https://foo.com/v1/classifiers/good",
				"status": "Available",
				"status_description": "The classifier instance is now available and is ready to take classifier requests."
			});


			nock(NLC_URL).post('/v1/classifiers/good/classify', {
				"text": "ocean with water"
			}).reply(200, {
				classifier_id: 'good',
				url: 'https://foo.com/v1/classifiers/good',
				text: 'ocean with birds',
				top_class: '/' + TEST_CONTAINER.name + '/' + TEST_CONTAINER_OBJECTS_ATTACHMENT.attachments[0].title,
				classes: [{
					class_name: '/' + TEST_CONTAINER.name + '/' + TEST_CONTAINER_OBJECTS_ATTACHMENT.attachments[0].title,
					confidence: 0.8865453325314453
				}]
			});


			room.user.say('mimiron', '@hubot objectstorage search ocean with water')
				.then(() => {
					return waitForMessageQueue(room, 2).then(() => {
						expect(room.messages[1]).to.eql(['hubot', '@mimiron ' + i18n.__('objectstore.search.object')]);
						done(new Error('Should not find a file'));
					});
				})
				.catch((error) => {
					if (error)
						done();
				});
		});
	});

	context('user calls `objectstorage help`', function() {
		beforeEach(function() {
			return room.user.say('mimiron', '@hubot objectstorage help');
		});

		it('should respond with the help', function() {
			expect(room.messages.length).to.eql(2);
			expect(room.messages[1][1]).to.be.a('string');
			let help = 'hubot objectstorage container list - ' + i18n.__('help.objectstorage.container.list') + '\n';
			help += `hubot objectstorage container details <container> - ` + i18n.__(
				'help.objectstorage.container.details') + '\n';
			help += 'hubot objectstorage retrieve <container> <object> - ' + i18n.__(
				'help.objectstorage.retrieve.object') + '\n';
			help += 'hubot objectstorage search <searchPhrase> - ' + i18n.__(
				'help.objectstorage.search') + '\n';
			expect(room.messages[1]).to.eql(['hubot', '@mimiron \n' + help]);
		});
	});

});
