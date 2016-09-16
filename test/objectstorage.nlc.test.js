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

const env = require('../src/lib/env');
const FakeTagGenerator = require('./fakeTagGenerator');
const Helper = require('hubot-test-helper');
const helper = new Helper('../src/scripts');
const expect = require('chai').expect;
const sprinkles = require('mocha-sprinkles');
const nock = require('nock');

const nlc_url = process.env.HUBOT_WATSON_NLC_URL;

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


const HUBOT_OBJECT_STORAGE_AUTH_URL = process.env.HUBOT_OBJECT_STORAGE_AUTH_URL;
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

const mockObjectMetadata = {
	"Accept-Ranges": "bytes",
	"Connection": "keep-alive",
	"Content-Length": 591,
	"Content-Type": "text/plain;charset=UTF-8",
	"Date": "Wed, 07 Sep 2016 13:15:40 GMT",
	"Etag": "3e8c9c501c1eda71513ac46892601da8",
	"Last-Modified": "Wed, 31 Aug 2016 20:52:26 GMT",
	"X-Object-Meta-Crawlernote1": "this is some meta data 1",
	"X-Object-Meta-Crawlernote2": "crawler note 2",
	"X-Timestamp": "1472676745.99607",
	"X-Trans-Id": "tx556425e96c9847b1ae0f6-0057d012fc"
};

describe('Test test via Slack', function() {

	let room;

	function doNock(){
		nock(nlc_url).get('/v1/classifiers').reply(200, {
			classifiers: [{
				"classifier_id": "good",
				"url": "https://foo.com/v1/classifiers/good",
				"name": "cloudbot-obj-storage-classifier",
				"language": "en",
				"created": "2016-08-22T15:08:28.176Z"
			}]
		});

		nock(nlc_url).post('/v1/classifiers', {}).reply(201,
			{
				"classifier_id": "good2",
				"url": "https://foo.com/v1/classifiers/good2",
				"name": "cloudbot-obj-storage-classifier",
				"language": "en",
				"status": "Training",
				"created": "2016-08-22T15:08:28.176Z"
			}
		);

		nock(nlc_url).get('/v1/classifiers/good2').reply(200, {
			"classifier_id": "good2",
			"name": "cloudbot-obj-storage-classifier",
			"language": "en",
			"created": "2016-08-10T15:08:28.176Z",
			"url": "https://foo.com/v1/classifiers/goods",
			"status": "Training",
			"status_description": "The classifier instance is now available and is ready to take classifier requests."
		});

		nock(nlc_url).get('/v1/classifiers/good').reply(200, {
			"classifier_id": "good",
			"name": "cloudbot-obj-storage-classifier",
			"language": "en",
			"created": "2016-08-10T15:08:28.176Z",
			"url": "https://foo.com/v1/classifiers/good",
			"status": "Available",
			"status_description": "The classifier instance is now available and is ready to take classifier requests."
		});

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

		nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/').query({
			format: 'json'
		}).reply(200, [TEST_CONTAINER]);

		nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/' + TEST_CONTAINER.name).query({
			format: 'json'
		}).reply(200, [TEST_CONTAINER_OBJECTS]);
		nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/' + TEST_CONTAINER.name + '/' + TEST_CONTAINER_OBJECTS_ATTACHMENT.attachments[0].title).query({
			format: 'json'
		}).reply(200, 'This is the text');
		nock(FAKE_OBJECT_STORAGE_ENDPOINT).head('/' + TEST_CONTAINER.name + '/' + TEST_CONTAINER_OBJECTS_ATTACHMENT.attachments[0].title).query({
			format: 'json'
		}).reply(200, '', mockObjectMetadata);
	}

	before(function() {
	});

	beforeEach(function() {
		room = helper.createRoom();

		doNock();


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

	context('user calls `objectstorage scan`', function() {
		it('should respond with the scan results', function(done) {
			room.user.say('mimiron', '@hubot objectstorage scan').then(() => {
				return waitForMessageQueue(room, 2).then(() => {
					expect(room.messages.length).to.eql(2);
					expect(room.messages[1][1]).to.be.a('string');
					expect(room.messages[1][1]).to.equal('@mimiron ' + 'Object Storage scan complete.  Changes since last indexing: 1 added, 0 removed.  Please run index command to process the changes.');
					done();
				});
			});
		});

		it('should respond with the scan status results', function(done) {
			room.user.say('mimiron', '@hubot objectstorage scan status').then(() => {
				return waitForMessageQueue(room, 2).then(() => {
					expect(room.messages.length).to.eql(2);
					expect(room.messages[1][1]).to.be.a('string');
					expect(room.messages[1][1]).to.include('@mimiron ' + 'Last scan run on');
					done();
				});
			});
		});

		it('should respond with the index results', function(done) {
			env.searchEngine.tagGenerators = [new FakeTagGenerator()];
			room.user.say('mimiron', '@hubot objectstorage index').then(() => {
				return waitForMessageQueue(room, 2).then(() => {
					expect(room.messages.length).to.eql(2);
					expect(room.messages[1][1]).to.be.a('string');
					expect(room.messages[1][1]).to.equal('@mimiron ' + 'NLC training for Object Storage started successfully.');
					done();
				});
			});
		});
	});
});
