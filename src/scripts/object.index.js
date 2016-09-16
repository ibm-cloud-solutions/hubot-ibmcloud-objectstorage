// Description:
//	Always listening, waiting to index and train Watson Natural Language Classifier.
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
	robot.on('objectstorage.index', (res, parameters) => {
		robot.logger.debug(`${TAG}: Natural Language match.`);
		processObjectStorageIndex(robot, res);
	});

	// Fixed command match
	const OBJECT_INDEX_PATTERN = /objectstorage\sindex/i;
	robot.respond(OBJECT_INDEX_PATTERN, {
		id: 'objectstorage.index'
	}, (res) => {
		robot.logger.debug(`${TAG}: res.message.text=${res.message.text}.`);
		processObjectStorageIndex(robot, res, res.match[1]);
	});

	// Common code
	function processObjectStorageIndex(robot, res) {
		if (!env.initSuccess) {
			// Abort.  objectstore.js reported the error to adapter already.
			robot.emit('ibmcloud.formatter', {
				response: res,
				message: env.initError
			});
			return;
		}

		let commandContext = {
			robot: robot,
			res: res
		};

		let callback = function(callbackContext, error) {
			callbackContext.robot.emit('ibmcloud.formatter', {
				response: callbackContext.res,
				message: i18n.__('objectstorage.scan.index.complete')
			});

		};

		env.searchEngine.index(callback, commandContext)
			.then((indexResult) => {
				robot.emit('ibmcloud.formatter', {
					response: res,
					message: indexResult.description
				});
			})
			.catch((error) => {
				robot.logger.error(
					`${TAG}: Failed to index object storage`, error);
				if (error.stack)
					robot.logger.error(
						`${TAG}: Failed to index object storage`, error.stack);

				robot.emit('ibmcloud.formatter', {
					response: res,
					message: i18n.__('objectstorage.index.error')
				});
			});

	}
};
