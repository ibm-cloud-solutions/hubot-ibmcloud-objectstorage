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
const NLCHelper = require('../src/lib/nlcHelper');
const ParamHelper = require('../src/lib/paramHelper');
const ObjectStorage = require('../src/lib/objectstore');
const Helper = require('hubot-test-helper');
const helper = new Helper('../src/scripts');
const nock = require('nock');
const expect = require('chai').expect;

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

	context('user calls `nlcHelper delete classifier`', function() {
		it('should delete old classifiers from NLC', function(done) {
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

			nock(env.nlc_url).get('/v1/classifiers').reply(200, {
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

			nock(env.nlc_url).get('/v1/classifiers/good').reply(200, {
				"classifier_id": "good",
				"name": "cloudbot-obj-storage-classifier",
				"language": "en",
				"created": "2016-08-10T15:08:28.176Z",
				"url": "https://foo.com/v1/classifiers/good",
				"status": "Available",
				"status_description": "The classifier instance is now available and is ready to take classifier requests."
			});

			nock(env.nlc_url).delete('/v1/classifiers/good').reply(200, {
				"classifier_id": "good"
			});

			nock(env.nlc_url).get('/v1/classifiers/better').reply(200, {
				"classifier_id": "better",
				"name": "cloudbot-obj-storage-classifier",
				"language": "en",
				"created": "2016-08-22T15:08:28.176Z",
				"url": "https://foo.com/v1/classifiers/better",
				"status": "Training",
				"status_description": "The classifier instance is now available and is ready to take classifier requests."
			});

			nock(env.nlc_url).get('/v1/classifiers/best').reply(200, {
				"classifier_id": "best",
				"name": "cloudbot-obj-storage-classifier",
				"language": "en",
				"created": "2016-08-22T15:08:28.176Z",
				"url": "https://foo.com/v1/classifiers/best",
				"status": "Available",
				"status_description": "The classifier instance is now available and is ready to take classifier requests."
			});

			nock(env.nlc_url).post('/v1/classifiers/good/classify', {
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
				},
				settings: env
			});
			nlcHelper.deleteOldClassifiers()
				.then((result) => {
					done();
				})
				.catch((err) => {
					done(err);
				});
		});

		it('should fail during delete of old classifiers from NLC', function(done) {
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

			nock(env.nlc_url).get('/v1/classifiers').reply(200, {
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

			nock(env.nlc_url).get('/v1/classifiers/good').reply(200, {
				"classifier_id": "good",
				"name": "cloudbot-obj-storage-classifier",
				"language": "en",
				"created": "2016-08-10T15:08:28.176Z",
				"url": "https://foo.com/v1/classifiers/good",
				"status": "Available",
				"status_description": "The classifier instance is now available and is ready to take classifier requests."
			});

			nock(env.nlc_url).delete('/v1/classifiers/good').reply(403, {
				"classifier_id": "good"
			});

			nock(env.nlc_url).get('/v1/classifiers/better').reply(200, {
				"classifier_id": "better",
				"name": "cloudbot-obj-storage-classifier",
				"language": "en",
				"created": "2016-08-22T15:08:28.176Z",
				"url": "https://foo.com/v1/classifiers/better",
				"status": "Training",
				"status_description": "The classifier instance is now available and is ready to take classifier requests."
			});

			nock(env.nlc_url).get('/v1/classifiers/best').reply(200, {
				"classifier_id": "best",
				"name": "cloudbot-obj-storage-classifier",
				"language": "en",
				"created": "2016-08-22T15:08:28.176Z",
				"url": "https://foo.com/v1/classifiers/best",
				"status": "Available",
				"status_description": "The classifier instance is now available and is ready to take classifier requests."
			});

			nock(env.nlc_url).post('/v1/classifiers/good/classify', {
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
				},
				settings: env
			});
			nlcHelper.deleteOldClassifiers()
				.then((result) => {
					done(new Error('should have failed to delete.'));
				})
				.catch((err) => {
					if (err)
						done();
				});
		});
	});

	context('user calls `forgets to add envs for NLC`', function() {
		it('should fail if missing nlc_url', function(done) {
			let nlcHelper = new NLCHelper({
				robot: {
					logger: {
						debug: function() {},
						info: function() {}

					}
				},
				settings: {}
			});

			expect(nlcHelper.initializedSuccessfully()).to.be.false;
			expect(nlcHelper.getMissingEnv()).to.eql('HUBOT_WATSON_NLC_URL');
			done();
		});

		it('should fail if missing nlc_username', function(done) {
			let nlcHelper = new NLCHelper({
				robot: {
					logger: {
						debug: function() {},
						info: function() {}

					}
				},
				settings: {
					nlc_url: 'http://foo'
				}
			});

			expect(nlcHelper.initializedSuccessfully()).to.be.false;
			expect(nlcHelper.getMissingEnv()).to.eql('HUBOT_WATSON_NLC_USERNAME');
			done();
		});

		it('should fail if missing nlc_password', function(done) {
			let nlcHelper = new NLCHelper({
				robot: {
					logger: {
						debug: function() {},
						info: function() {}

					}
				},
				settings: {
					nlc_url: 'http://foo',
					nlc_username: 'foo'
				}
			});

			expect(nlcHelper.initializedSuccessfully()).to.be.false;
			expect(nlcHelper.getMissingEnv()).to.eql('HUBOT_WATSON_NLC_PASSWORD');
			done();
		});

		it('should fail if missing nlc_objectstorage_classifier', function(done) {
			let nlcHelper = new NLCHelper({
				robot: {
					logger: {
						debug: function() {},
						info: function() {}

					}
				},
				settings: {
					nlc_url: 'http://foo',
					nlc_username: 'foo',
					nlc_password: 'bar'
				}
			});

			expect(nlcHelper.initializedSuccessfully()).to.be.false;
			expect(nlcHelper.getMissingEnv()).to.eql('HUBOT_WATSON_NLC_OJBECTSTORAGE_CLASSIFIER_NAME');
			done();
		});
	});

	context('user calls `forgets to add envs for ObjectStorage`', function() {
		it('should fail if missing os_auth_url', function(done) {
			let paramHelper = new ParamHelper({
				robot: {
					logger: {
						debug: function() {},
						info: function() {}

					}
				},
				settings: {}
			});

			expect(paramHelper.initializedSuccessfully()).to.be.false;
			expect(paramHelper.getMissingEnv()).to.eql('HUBOT_OBJECT_STORAGE_AUTH_URL');
			done();
		});

		it('should fail if missing os_user_id', function(done) {
			let paramHelper = new ParamHelper({
				robot: {
					logger: {
						debug: function() {},
						info: function() {}

					}
				},
				settings: {
					os_auth_url: 'http://ibm.com'
				}
			});

			expect(paramHelper.initializedSuccessfully()).to.be.false;
			expect(paramHelper.getMissingEnv()).to.eql('HUBOT_OBJECT_STORAGE_USER_ID');
			done();
		});

		it('should fail if missing os_password', function(done) {
			let paramHelper = new ParamHelper({
				robot: {
					logger: {
						debug: function() {},
						info: function() {}

					}
				},
				settings: {
					os_auth_url: 'http://ibm.com',
					os_user_id: 'foo'
				}
			});

			expect(paramHelper.initializedSuccessfully()).to.be.false;
			expect(paramHelper.getMissingEnv()).to.eql('HUBOT_OBJECT_STORAGE_PASSWORD');
			done();

		});

		it('should fail if missing os_project_id', function(done) {
			let paramHelper = new ParamHelper({
				robot: {
					logger: {
						debug: function() {},
						info: function() {}

					}
				},
				settings: {
					os_auth_url: 'http://ibm.com',
					os_user_id: 'foo',
					os_password: 'bar'
				}
			});

			expect(paramHelper.initializedSuccessfully()).to.be.false;
			expect(paramHelper.getMissingEnv()).to.eql('HUBOT_OBJECT_STORAGE_PROJECT_ID');
			done();
		});

		it('should fail to initialize ObjectStorage if missing os_project_id', function(done) {
			let storage = new ObjectStorage({
				robot: {
					logger: {
						debug: function() {},
						info: function() {}

					}
				},
				res: {},
				settings: {
					os_auth_url: 'http://ibm.com',
					os_user_id: 'foo',
					os_password: 'bar',
					os_project_id: 'foobar'
				}
			});

			expect(storage.initializedSuccessfully()).to.be.false;
			expect(storage.getMissingEnv()).to.eql('HUBOT_OBJECT_STORAGE_BLUEMIX_REGION');
			done();
		});

		it('should fail to getContainers if missing os_project_id', function(done) {
			let storage = new ObjectStorage({
				robot: {
					logger: {
						debug: function() {},
						info: function() {}

					}
				},
				res: {},
				settings: {
					os_auth_url: 'http://ibm.com',
					os_user_id: 'foo',
					os_password: 'bar',
					os_project_id: 'foobar'
				}
			});

			expect(storage.initializedSuccessfully()).to.be.false;
			expect(storage.getMissingEnv()).to.eql('HUBOT_OBJECT_STORAGE_BLUEMIX_REGION');
			storage.getContainers().catch((error) => {
				if (error)
					done();
			});
		});

		it('should fail to getContainerDetails if missing os_project_id', function(done) {
			let storage = new ObjectStorage({
				robot: {
					logger: {
						debug: function() {},
						info: function() {}

					}
				},
				res: {},
				settings: {
					os_auth_url: 'http://ibm.com',
					os_user_id: 'foo',
					os_password: 'bar',
					os_project_id: 'foobar'
				}
			});

			expect(storage.initializedSuccessfully()).to.be.false;
			expect(storage.getMissingEnv()).to.eql('HUBOT_OBJECT_STORAGE_BLUEMIX_REGION');
			storage.getContainerDetails('name').catch((error) => {
				if (error)
					done();
			});
		});

		it('should fail to getObject if missing os_project_id', function(done) {
			let storage = new ObjectStorage({
				robot: {
					logger: {
						debug: function() {},
						info: function() {}

					}
				},
				res: {},
				settings: {
					os_auth_url: 'http://ibm.com',
					os_user_id: 'foo',
					os_password: 'bar',
					os_project_id: 'foobar'
				}
			});

			expect(storage.initializedSuccessfully()).to.be.false;
			expect(storage.getMissingEnv()).to.eql('HUBOT_OBJECT_STORAGE_BLUEMIX_REGION');
			storage.getObject('name', 'name').catch((error) => {
				if (error)
					done();
			});
		});
	});

});
