// Description:
//	Always listening, waiting to translate
//
// Configuration:
// HUBOT_OBJECT_STORAGE_AUTH_URL The Auth URL provided by Object Storage service
// HUBOT_OBJECT_STORAGE_USER_ID The Object Storage user id
// HUBOT_OBJECT_STORAGE_PASSWORD The Objeect Storage password
// HUBOT_OBJECT_STORAGE_PROJECT_ID The Object Storage project id
// HUBOT_OBJECT_STORAGE_BLUEMIX_REGION The bluemix region you wish to target.  For example dallas.
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

const Helper = require('../lib/paramHelper');
const path = require('path');
const TAG = path.basename(__filename);
const Conversation = require('hubot-conversation');
const _ = require('lodash');
const activity = require('hubot-ibmcloud-activity-emitter');
const NLCHelper = require('../lib/nlcHelper');

const NLC_SEARCH_CONFIDENCE_MIN = parseFloat(process.env.NLC_SEARCH_CONFIDENCE_MIN) || 0.25;
const NLC_SEARCH_RESULT_LIMIT = parseInt(process.env.NLC_SEARCH_RESULT_LIMIT, 10) || 3;
const NLC_SEARCH_CLASSIFIER_CLEANUP_INTERVAL = parseInt(process.env.NLC_SEARCH_CLASSIFIER_CLEANUP_INTERVAL, 10) || 1000 *
	60 * 60; // Default to every hour

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
let storage;
module.exports = (robot, res) => {
	if (!helper) {
		helper = new Helper({
			robot: robot,
			res: res
		});
		if (helper.initializedSuccessfully()) {
			storage = helper.getObjectStorage();
		}
		else {
			storage = undefined;
		}
	}

	const switchBoard = new Conversation(robot);
	let context = {
		res: res,
		robot: robot,
		switchBoard: switchBoard
	};

	let nlcHelper = new NLCHelper(context);

	enableClassifierCleanupInterval();

	// Natural Language match
	robot.on('objectstorage.search.object', (res, parameters) => {
		robot.logger.debug(`${TAG}: Natural Language match.`);
		// Parameter values are obtain through the cognitive/nlc process.
		// Verify that required parameter values were succesfully obtained.
		if (parameters && parameters.searchphrase) {
			processObjectSearch(robot, res, parameters.searchphrase);
		}
		else {
			robot.logger.error(`${TAG}: Error extracting container name from text [${res.message.text}].`);
			robot.emit('ibmcloud.formatter', {
				response: res,
				message: i18n.__('cognitive.parse.problem.search')
			});
		}
	});

	// Fixed command match
	const OBJECT_SEARCH_PATTERN = /objectstorage\ssearch\s?(.*)/i;
	robot.respond(OBJECT_SEARCH_PATTERN, {
		id: 'objectstorage.retrieve.object'
	}, (res) => {
		robot.logger.debug(`${TAG}: res.message.text=${res.message.text}.`);
		processObjectSearch(robot, res, res.match[1]);
	});

	function enableClassifierCleanupInterval() {
		if (nlcHelper.initializedSuccessfully()) {
			context.robot.logger.debug('NLC enabled so classifier will take place');
			setInterval(() => {
				nlcHelper.deleteOldClassifiers()
					.then((result) => {
						robot.logger.debug('Successfully deleted old classifiers.  ' + JSON.stringify(result, null, 2));
					})
					.catch((err) => {
						robot.logger.error('Problem deleting old classifiers.', err);
					});
			}, NLC_SEARCH_CLASSIFIER_CLEANUP_INTERVAL);
		}
		else {
			context.robot.logger.debug('NLC not enabled so classifier cannot take place');
		}
	}

	function searchForObject(context, nlcHelper, searchPhrase) {
		return nlcHelper.classify(searchPhrase)
			.then((classifierResult) => {
				let matches = [];
				if (classifierResult.classes) {
					let count = 0;
					_.forEach(classifierResult.classes, (classifier) => {
						let path = classifier.class_name.split('/');
						if (classifier.confidence >= NLC_SEARCH_CONFIDENCE_MIN) {
							matches.push({
								containerName: path[1],
								objectName: path[2]
							});
							count++;
							if (count >= NLC_SEARCH_RESULT_LIMIT)
								return false;
						}
					});
				}
				context.robot.logger.debug(`${TAG}: Found the following classifier matches: ` + JSON.stringify(matches));
				return matches;
			});
	}

	// Common code
	function processObjectSearch(robot, res, searchPhrase) {
		if (!storage) {
			// Abort.  objectstore.js reported the error to adapter already.
			robot.emit('ibmcloud.formatter', {
				response: res,
				message: i18n.__('objectstorage.missing.envs', helper.getMissingEnv())
			});
			return;
		}

		if (!nlcHelper.initializedSuccessfully()) {
			// Abort.  objectstore.js reported the error to adapter already.
			robot.emit('ibmcloud.formatter', {
				response: res,
				message: i18n.__('objectstorage.missing.envs', nlcHelper.getMissingEnv())
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

		searchForObject(context, nlcHelper, searchPhrase)
			.then((objectList) => {
				let downloadPromises = [];
				_.forEach(objectList, (objectDetails) => {
					robot.logger.debug(
						`${TAG}: Downloading ${objectDetails.containerName} container and ${objectDetails.objectName} object for search command.`
					);
					downloadPromises.push(storage.getObject(objectDetails.containerName, objectDetails.objectName));
				});
				return Promise.all(downloadPromises);
			})
			.then((downloadedObjects) => {
				let message = i18n.__('objectstore.search.object');
				robot.emit('ibmcloud.formatter', {
					response: res,
					message: message
				});
				_.forEach(downloadedObjects, (downloadedObject) => {
					robot.logger.debug(`${TAG}: Temp file created for ${downloadedObject.name} at ${downloadedObject.path}`);
					robot.emit('ibmcloud.formatter', {
						response: res,
						fileName: downloadedObject.name,
						filePath: downloadedObject.path
					});
					activity.emitBotActivity(robot, res, {
						activity_id: 'activity.objectstorage.retrieve.object'
					});
				});
			})
			.catch((error) => {
				robot.logger.error(
					`${TAG}: Failed to find objects`, error);
				robot.logger.error(
					`${TAG}: Failed to find objects`, error.stack);

				robot.emit('ibmcloud.formatter', {
					response: res,
					message: i18n.__('objectstorage.retrieve.error')
				});
			});
	}
};
