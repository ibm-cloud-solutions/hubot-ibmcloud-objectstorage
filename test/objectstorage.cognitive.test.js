/*
 * Licensed Materials - Property of IBM
 * (C) Copyright IBM Corp. 2016. All Rights Reserved.
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */

'use strict';

const Helper = require('hubot-test-helper');
const helper = new Helper('../src/scripts');
const expect = require('chai').expect;
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

/* eslint quote-props:0, quotes:0*/

const NLC_URL = process.env.VCAP_SERVICES_NATURAL_LANGUAGE_CLASSIFIER_0_CREDENTIALS_URL || process.env.HUBOT_WATSON_NLC_URL;
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

// Passing arrow functions to mocha is discouraged: https://mochajs.org/#arrow-functions
// return promises from mocha tests rather than calling done() - http://tobyho.com/2015/12/16/mocha-with-promises/
describe('Interacting with Bluemix services via Slack / Natural Language', function() {

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
	});

	afterEach(function() {
		room.destroy();
	});

	// ------------------------------------------------------
	// Test: container details
	// ------------------------------------------------------
	context('Container details - user says `Can I have details on the object storage container` ' + TEST_CONTAINER.name, function() {
		beforeEach(function() {
			nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/').query({
				format: 'json'
			}).reply(200, [TEST_CONTAINER]);
			nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/' + TEST_CONTAINER.name).query({
				format: 'json'
			}).reply(200, [TEST_CONTAINER_OBJECTS]);
		});
		it('should recognize command and prompt for a name', function(done) {
			// Listens for dialog response.
			room.robot.on('ibmcloud.formatter', (event) => {
				if (event.message) {
					expect(event.message).to.eql(i18n.__('objectstorage.list.objects', TEST_CONTAINER.name));
					done();
				}
			});

			var res = { message: {text: 'Can I have details on the object storage container', user: { id: 'mimiron'}}, response: room };
			room.robot.emit('objectstorage.container.details', res, { containername: TEST_CONTAINER.name});
		});
	});

	// ------------------------------------------------------
	// Test: container details without parameter
	// ------------------------------------------------------
	context('Container details - user says `Can I have details on the object storage container (no parameter)', function() {
		beforeEach(function() {
			nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/').query({
				format: 'json'
			}).reply(200, [TEST_CONTAINER]);
			nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/' + TEST_CONTAINER.name).query({
				format: 'json'
			}).reply(200, [TEST_CONTAINER_OBJECTS]);
		});
		it('should recognize command and prompt for a name', function(done) {
			// Listens for dialog response.
			room.robot.on('ibmcloud.formatter', (event) => {
				if (event.message) {
					expect(event.message).to.eql(i18n.__('cognitive.parse.problem.details'));
					done();
				}
			});

			var res = { message: {text: 'Can I have details on the object storage container', user: { id: 'mimiron'}}, response: room };
			room.robot.emit('objectstorage.container.details', res);
		});
	});

	// ------------------------------------------------------
	// Test: container list
	// ------------------------------------------------------
	context('Container list - user says `Show me the object storage containers', function() {
		beforeEach(function() {
			nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/').query({
				format: 'json'
			}).reply(200, [TEST_CONTAINER]);
		});
		it('should recognize command and present a list of containers', function(done) {
			// Listens for dialog response.
			room.robot.on('ibmcloud.formatter', (event) => {
				if (event.message) {
					expect(event.message).to.eql(i18n.__('objectstorage.list.containers'));
					done();
				}
			});

			var res = { message: {text: 'Can I have details on the object storage container', user: { id: 'mimiron'}}, response: room };
			room.robot.emit('objectstorage.container.list', res);
		});
	});

	// ------------------------------------------------------
	// Test: object retrieve
	// ------------------------------------------------------
	context('Object retrieve - user says `Get an object from the container', function() {
		beforeEach(function() {
			room.robot.adapterName = 'slack';
			nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/').query({
				format: 'json'
			}).reply(200, [TEST_CONTAINER]);
			nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/' + TEST_CONTAINER.name).query({
				format: 'json'
			}).reply(200, [TEST_CONTAINER_OBJECTS]);
			nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/' + TEST_CONTAINER.name + '/' + TEST_CONTAINER_OBJECTS_ATTACHMENT.attachments[0].title).query({
				format: 'json'
			}).reply(200, 'This is the text');
		});
		it('should recognize command and respond accordingly', function(done) {
			// Listens for dialog response.
			room.robot.on('ibmcloud.formatter', (event) => {
				if (event.message) {
					expect(event.message).to.eql(i18n.__('objectstore.retrieve.object', 'foo.txt'));
					done();
				}
			});

			var res = { message: {text: 'Get an object from the container', user: { id: 'mimiron'}}, response: room };
			room.robot.emit('objectstorage.retrieve.object', res, { containername: TEST_CONTAINER.name, objectname: 'foo.txt'});
		});
	});

	// ------------------------------------------------------
	// Test: object retrieve (missing parameters)
	// ------------------------------------------------------
	context('Object retrieve - user says `Get an object from the container (missing parameters)', function() {
		beforeEach(function() {
			room.robot.adapterName = 'slack';
			nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/').query({
				format: 'json'
			}).reply(200, [TEST_CONTAINER]);
			nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/' + TEST_CONTAINER.name).query({
				format: 'json'
			}).reply(200, [TEST_CONTAINER_OBJECTS]);
			nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/' + TEST_CONTAINER.name + '/' + TEST_CONTAINER_OBJECTS_ATTACHMENT.attachments[0].title).query({
				format: 'json'
			}).reply(200, 'This is the text');
		});
		it('should recognize command and respond accordingly', function(done) {
			// Listens for dialog response.
			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.eql(i18n.__('cognitive.parse.problem.retrieve'));
				done();
			});

			var res = { message: {text: 'Get an object from the container', user: { id: 'mimiron'}}, response: room };
			room.robot.emit('objectstorage.retrieve.object', res);
		});
	});

	context('user calls `objectstorage search`', function() {
		beforeEach(function() {
			room.robot.adapterName = 'slack';
			nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/').query({
				format: 'json'
			}).reply(200, [TEST_CONTAINER]);
			nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/' + TEST_CONTAINER.name).query({
				format: 'json'
			}).reply(200, [TEST_CONTAINER_OBJECTS]);
			nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/' + TEST_CONTAINER.name + '/' + TEST_CONTAINER_OBJECTS_ATTACHMENT.attachments[0].title).query({
				format: 'json'
			}).reply(200, 'This is the text');
			nock(NLC_URL).get('/v1/classifiers').reply(200, {classifiers: [
				{
					"classifier_id": "good",
					"url": "https://foo.com/v1/classifiers/good",
					"name": "cloudbot-obj-storage-classifier",
					"language": "en",
					"created": "2016-08-22T15:08:28.176Z"
				}
			]});

			nock(NLC_URL).get('/v1/classifiers/good').reply(200, {
				"classifier_id": "good",
				"name": "cloudbot-obj-storage-classifier",
				"language": "en",
				"created": "2016-08-22T15:08:28.176Z",
				"url": "https://foo.com/v1/classifiers/good",
				"status": "Available",
				"status_description": "The classifier instance is now available and is ready to take classifier requests."
			});


			nock(NLC_URL).post('/v1/classifiers/good/classify', {"text": "ocean with birds"}).reply(200, {
				classifier_id: 'good',
				url: 'https://foo.com/v1/classifiers/good',
				text: 'ocean with birds',
				top_class: '/' + TEST_CONTAINER.name + '/' + TEST_CONTAINER_OBJECTS_ATTACHMENT.attachments[0].title,
				classes: [{
					class_name: '/' + TEST_CONTAINER.name + '/' + TEST_CONTAINER_OBJECTS_ATTACHMENT.attachments[0].title,
					confidence: 0.8865453325314453
				}]
			});
		});

		it('should recognize command and respond accordingly', function(done) {
			// Listens for dialog response.
			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.eql(i18n.__('cognitive.parse.problem.search'));
				done();
			});

			var res = { message: {text: 'Search for an object in a container', user: { id: 'mimiron'}}, response: room };
			room.robot.emit('objectstorage.search.object', res);
		});
	});

	// ------------------------------------------------------
	// Test: object storage help
	// ------------------------------------------------------
	context('Object storage help - user says `What are the objectstorage commands', function() {
		it('should recognize command and respond with help', function(done) {
			// Listens for dialog response.
			room.robot.on('ibmcloud.formatter', (event) => {
				let help = 'hubot objectstorage container list - ' + i18n.__('help.objectstorage.container.list') + '\n';
				help += `hubot objectstorage container details <container> - ` + i18n.__(
					'help.objectstorage.container.details') + '\n';
				help += 'hubot objectstorage retrieve <container> <object> - ' + i18n.__(
					'help.objectstorage.retrieve.object') + '\n';
				expect(event.message).to.contain(help);
				done();
			});

			var res = { message: {text: 'What are the objectstorage commands', user: { id: 'mimiron'}}, response: room };
			room.robot.emit('objectstorage.container.help', res);
		});
	});

	context('verify entity functions', function() {
		let storage;

		beforeEach(function() {
			nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/').query({
				format: 'json'
			}).reply(200, [TEST_CONTAINER]);

			const ParamHelper = require('../src/lib/paramHelper');
			const env = require('../src/lib/env');
			var res = { message: {text: '', user: {id: 'mimiron'}}, response: room };
			let paramHelper = new ParamHelper({
				robot: room.robot,
				res: res,
				settings: env
			});
			if (paramHelper.initializedSuccessfully()) {
				storage = paramHelper.getObjectStorage();
			}
			else {
				storage = undefined;
			}
		});

		it('should retrieve set of container names', function(done) {
			const entities = require('../src/lib/objectstore.entities');
			var res = { message: {text: '', user: {id: 'mimiron'}}, response: room };
			entities.registerEntityFunctions(storage);
			entities.getContainerNames(room.robot, res, 'containername', {}).then(function(containerNames) {
				expect(containerNames.length).to.eql(1);
				done();
			}).catch(function(error) {
				done(error);
			});
		});
	});

});
