/*
 * Licensed Materials - Property of IBM
 * (C) Copyright IBM Corp. 2016. All Rights Reserved.
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */
'use strict';

// Passing arrow functions to mocha is discouraged: https://mochajs.org/#arrow-functions
// return promises from mocha tests rather than calling done() - http://tobyho.com/2015/12/16/mocha-with-promises/


/* eslint quote-props:0, quotes:0*/

const NLCHelper = require('../src/lib/nlcHelper');
const Helper = require('hubot-test-helper');
const helper = new Helper('../src/scripts');
const nock = require('nock');

var i18n = new (require('i18n-2'))({
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

	context('user calls `objectstorage search`', function() {
		it('should search for a file and upload to adapter', function(done) {
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

			nock(NLC_URL).get('/v1/classifiers').reply(200, {
				classifiers: [{
					"classifier_id": "good",
					"url": "https://foo.com/v1/classifiers/good",
					"name": "cloudbot-obj-storage-classifier",
					"language": "en",
					"created": "2016-08-22T15:08:28.176Z"
				}, {
					"classifier_id": "better",
					"url": "https://foo.com/v1/classifiers/good",
					"name": "cloudbot-obj-storage-classifier",
					"language": "en",
					"created": "2016-08-22T15:08:28.176Z"
				}, {
					"classifier_id": "best",
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
				"created": "2016-08-10T15:08:28.176Z",
				"url": "https://foo.com/v1/classifiers/good",
				"status": "Available",
				"status_description": "The classifier instance is now available and is ready to take classifier requests."
			});

			nock(NLC_URL).delete('/v1/classifiers/good').reply(200, {
				"classifier_id": "good"
			});

			nock(NLC_URL).get('/v1/classifiers/better').reply(200, {
				"classifier_id": "better",
				"name": "cloudbot-obj-storage-classifier",
				"language": "en",
				"created": "2016-08-22T15:08:28.176Z",
				"url": "https://foo.com/v1/classifiers/better",
				"status": "Training",
				"status_description": "The classifier instance is now available and is ready to take classifier requests."
			});

			nock(NLC_URL).get('/v1/classifiers/best').reply(200, {
				"classifier_id": "best",
				"name": "cloudbot-obj-storage-classifier",
				"language": "en",
				"created": "2016-08-22T15:08:28.176Z",
				"url": "https://foo.com/v1/classifiers/best",
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

			let nlcHelper = new NLCHelper({
				robot: {
					logger: {
						debug: function() {},
						info: function() {}

					}
				}
			});
			nlcHelper.deleteOldClassifiers()
				.then((result) => {
					done();
				})
				.catch((err) => {
					done(err);
				});
		});
	});
});
