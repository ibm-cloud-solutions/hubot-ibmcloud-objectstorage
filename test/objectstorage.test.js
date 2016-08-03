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

const Helper = require('hubot-test-helper');
const helper = new Helper('../src/scripts');
const expect = require('chai').expect;
// const rewire = require('rewire');
// const objectstorageAPI = rewire('../src/scripts/objectstorage');
const sprinkles = require('mocha-sprinkles');
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

const timeout = 5000;

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
			nock(FAKE_OBJECT_STORAGE_ENDPOINT).get('/' + TEST_CONTAINER.name + '/' + TEST_CONTAINER_OBJECTS_ATTACHMENT.attachments[0].title).query({
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
			expect(room.messages[1]).to.eql(['hubot', '@mimiron \n' + help]);
		});
	});

});
