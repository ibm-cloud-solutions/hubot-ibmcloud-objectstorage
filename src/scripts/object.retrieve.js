// Description:
//	Always listening, waiting to retrieve object from container
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
const Conversation = require('hubot-conversation');
const activity = require('hubot-ibmcloud-activity-emitter');
const entities = require('../lib/objectstore.entities');

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

			// Register entity handling functions
			entities.registerEntityFunctions();
		}
	}


	const switchBoard = new Conversation(robot);

	// Natural Language match
	robot.on('objectstorage.retrieve.object', (res, parameters) => {
		robot.logger.debug(`${TAG}: Natural Language match.`);
		// Parameter values are obtain through the cognitive/nlc process.
		// Verify that required parameter values were succesfully obtained.
		if (parameters && parameters.containername && parameters.objectname) {
			processObjectRetrieve(robot, res, parameters.containername, parameters.objectname);
		}
		else {
			robot.logger.error(`${TAG}: Error extracting container name from text [${res.message.text}].`);
			robot.emit('ibmcloud.formatter', { response: res, message: i18n.__('cognitive.parse.problem.retrieve') });
		}
	});

	// Fixed command match
	const OBJECT_RETRIEVE_PATTERN = /objectstorage\sretrieve\s?(\S*)\s?(.*)/i;
	robot.respond(OBJECT_RETRIEVE_PATTERN, {id: 'objectstorage.retrieve.object'}, (res) => {
		robot.logger.debug(`${TAG}: res.message.text=${res.message.text}.`);
		processObjectRetrieve(robot, res, res.match[1], res.match[2]);
	});

	// Common code
	function processObjectRetrieve(robot, res, containerName, objectName) {
		if (!env.initSuccess) {
			// Abort.  objectstore.js reported the error to adapter already.
			robot.emit('ibmcloud.formatter', {
				response: res,
				message: env.initError
			});
			return;
		}

		if (!helper.isAdapterSupported(robot.adapterName)) {
			robot.emit('ibmcloud.formatter', {
				response: res,
				message: i18n.__('objectstorage.retrieve.nosupported.adapter', robot.adapterName)
			});
			return;
		}

		let context = {
			res: res,
			robot: robot,
			switchBoard: switchBoard
		};
		helper.obtainContainerName(context, containerName)
			.then((containerName) => {
				robot.logger.debug(`${TAG}: Selected ${containerName} container for object retrieve command.`);
				return helper.obtainObjectName(context, containerName, objectName);
			})
			.then((objectDetails) => {
				robot.logger.debug(
					`${TAG}: Selected ${objectDetails.containerName} container and ${objectDetails.objectName} object for retrieve command.`
				);
				return env.objectStorage.getObject(objectDetails.containerName, objectDetails.objectName);
			})
			.then((downloadedObject) => {
				robot.logger.debug(`${TAG}: Temp file created for ${downloadedObject.name} at ${downloadedObject.path}`);
				let message = i18n.__('objectstore.retrieve.object', downloadedObject.name);
				robot.emit('ibmcloud.formatter', {
					response: res,
					message: message
				});
				robot.emit('ibmcloud.formatter', {
					response: res,
					fileName: downloadedObject.name,
					filePath: downloadedObject.path
				});
				activity.emitBotActivity(robot, res, {
					activity_id: 'activity.objectstorage.retrieve.object'
				});

			})
			.catch((error) => {
				robot.logger.error(
					`${TAG}: Failed to upload object`, error);
				robot.logger.error(
					`${TAG}: Failed to upload object`, error.stack);

				robot.emit('ibmcloud.formatter', {
					response: res,
					message: i18n.__('objectstorage.retrieve.error')
				});

			});
	}
};
