/*
 * Licensed Materials - Property of IBM
 * (C) Copyright IBM Corp. 2016. All Rights Reserved.
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */
'use strict';

const osAuthUrl = process.env.HUBOT_OBJECT_STORAGE_AUTH_URL;
const osEndpoint = 'http://storestuff.com';
const osAuthPayload = {
	token: {
		catalog: [{
			type: 'object-store',
			endpoints: [{
				region: 'dallas',
				interface: 'public',
				url: osEndpoint
			}]
		}]
	}
};
const testContainer = {
	name: 'TestContainer',
	bytes: '1024',
	count: 54
};

const testContainerObjects = {
	name: 'foo.txt',
	bytes: '1024',
	last_modified: 'yesterday',
	hash: 'ASDFdsfsdf',
	content_type: 'text'
};

const testContainerAttachment = {
	attachments: [{
		color: '#555',
		fields: [{
			short: true,
			title: 'size',
			value: '1.00K'
		}, {
			short: true,
			title: 'file count',
			value: '54'
		}],
		title: 'TestContainer'
	}]
};

const testContainerObjectAttachment = {
	attachments: [{
		color: '#555',
		fields: [{
			short: true,
			title: 'size',
			value: '1.00K'
		}, {
			short: true,
			title: 'last modified',
			value: 'yesterday'
		}, {
			short: true,
			title: 'content type',
			value: 'text'
		}, {
			short: true,
			title: 'hash',
			value: 'ASDFdsfsdf'
		}],
		title: 'foo.txt'
	}]
};

module.exports = {
	osAuthUrl: osAuthUrl,
	osEndpoint: osEndpoint,
	osAuthPayload: osAuthPayload,
	testContainer: testContainer,
	testContainerObject: testContainerObjects,
	testContainerAttachment: testContainerAttachment,
	testContainerObjectAttachment: testContainerObjectAttachment
};
