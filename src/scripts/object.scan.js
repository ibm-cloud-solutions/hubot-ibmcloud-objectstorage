// Description:
//	Always listening, waiting to scan Object Storage for changes to the fileset.  This creates the required data to index and train Watson Natural Language Classifier for search.
//
// Configuration:
//
// Author:
//  @kholdaway
//

/*
 * Licensed Materials - Property of IBM
 * (C) Copyright IBM Corp. 2016. All Rights Reserved.
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */
'use strict';

const env = require('../lib/env');
const Helper = require('../lib/paramHelper');
const path = require('path');
const TAG = path.basename(__filename);

const i18n = new (require('i18n-2'))({
	locales: ['en'],
	extension: '.json',
	// Add more languages to the list of locales when the files are created.
	directory: __dirname + '/../messages',
	defaultLocale: 'en',
	// Prevent messages file from being overwritten in error conditions (like poor JSON).
	updateFiles: false
});
// At some point we need to toggle this setting based on some user input.
i18n.setLocale('en');

let helper;
module.exports = (robot, res) => {
	if (!helper) {
		if (env.initSuccess) {
			helper = new Helper({
				robot: robot,
				res: res
			});
		}
	}

	// Natural Language match
	robot.on('objectstorage.scan', (res, parameters) => {
		robot.logger.debug(`${TAG}: Natural Language match.`);
		processObjectStorageScan(robot, res);
	});

	// Fixed command match
	const OBJECT_SCAN_PATTERN = /objectstorage\sscan\s*$/i;
	robot.respond(OBJECT_SCAN_PATTERN, {
		id: 'objectstorage.scan'
	}, (res) => {
		robot.logger.debug(`${TAG}: res.message.text=${res.message.text}.`);
		processObjectStorageScan(robot, res, res.match[1]);
	});

	// Common code
	function processObjectStorageScan(robot, res) {
		if (!env.initSuccess) {
			// Abort.  objectstore.js reported the error to adapter already.
			robot.emit('ibmcloud.formatter', {
				response: res,
				message: env.initError
			});
			return;
		}

		env.searchEngine.scan()
			.then((scanResult) => {
				robot.emit('ibmcloud.formatter', {
					response: res,
					message: scanResult.description
				});
			})
			.catch((error) => {
				robot.logger.error(
					`${TAG}: Failed to scan object storage`, error);
				if (error.stack)
					robot.logger.error(
						`${TAG}: Failed to scan object storage`, error.stack);

				robot.emit('ibmcloud.formatter', {
					response: res,
					message: i18n.__('objectstorage.scan.error')
				});
			});

	}
};
