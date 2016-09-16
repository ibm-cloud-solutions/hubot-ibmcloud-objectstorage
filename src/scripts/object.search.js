// Description:
//	Always listening, waiting to search containers for files
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
const _ = require('lodash');
const activity = require('hubot-ibmcloud-activity-emitter');

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

	let context = {
		res: res,
		robot: robot
	};

	// Natural Language match
	robot.on('objectstorage.search.object', (res, parameters) => {
		robot.logger.debug(`${TAG}: Natural Language match.`);
		// Parameter values are obtain through the cognitive/nlc process.
		// Verify that required parameter values were succesfully obtained.
		if (parameters && parameters.searchphrase) {
			processObjectSearch(robot, res, parameters.searchphrase);
		}
		else {
			robot.logger.error(`${TAG}: Error extracting search phrase from text [${res.message.text}].`);
			robot.emit('ibmcloud.formatter', {
				response: res,
				message: i18n.__('cognitive.parse.problem.search')
			});
		}
	});

	// Fixed command match
	const OBJECT_SEARCH_PATTERN = /objectstorage\ssearch\s?(.*)/i;
	robot.respond(OBJECT_SEARCH_PATTERN, {
		id: 'objectstorage.search.object'
	}, (res) => {
		robot.logger.debug(`${TAG}: res.message.text=${res.message.text}.`);
		processObjectSearch(robot, res, res.match[1]);
	});

	function searchForObject(context, searchPhrase) {
		return env.searchEngine.classify(searchPhrase, true)
			.then((classifierResult) => {
				let matches = [];
				if (!classifierResult.search_successful || !classifierResult.classify_result) {
					// no result returned
					let error = classifierResult.description ? new Error(classifierResult.description) : new Error(classifierResult);
					context.robot.logger.error(`${TAG}: No classifiers are available at this time.`, error);

					robot.emit('ibmcloud.formatter', {
						response: res,
						message: classifierResult.description
					});

					return [];
				}
				else if (classifierResult.classify_result.classes) {
					let count = 0;
					context.robot.logger.debug(`${TAG}: Classify results for searchPhrase ${searchPhrase}`);
					_.forEach(classifierResult.classify_result.classes, (classifier) => {
						context.robot.logger.debug(`${TAG}:  classify results:  ` + JSON.stringify(classifier));
						let path = classifier.class_name.split('/');
						if (classifier.confidence >= env.nlc_search_confidence_min) {
							let training_data = classifier.training_data ? _.uniq(classifier.training_data) : [];
							matches.push({
								containerName: path[1],
								objectName: path[2],
								confidence: classifier.confidence,
								training_data: training_data
							});
							count++;
							if (count >= env.nlc_search_result_limit)
								return false;
						}
					});
				}
				context.robot.logger.debug(`${TAG}: Found the following classifier matches: ` + JSON.stringify(matches));
				return matches;
			})
			.catch((error) => {
				context.robot.logger.error(`${TAG}: No classifiers are available at this time.`, error);
				return [];
			});
	}

	// Common code
	function processObjectSearch(robot, res, searchPhrase) {
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

		searchForObject(context, searchPhrase)
			.then((objectList) => {
				let downloadPromises = [];
				downloadPromises.push(Promise.resolve(objectList));
				_.forEach(objectList, (objectDetails) => {
					robot.logger.debug(
						`${TAG}: Downloading ${objectDetails.containerName} container and ${objectDetails.objectName} object for search command.`
					);
					downloadPromises.push(env.objectStorage.getObject(objectDetails.containerName, objectDetails.objectName).catch(
						(err) => {
							robot.logger.error(
								`${TAG}: Object storage did not contain an object named '${objectDetails.objectName}' in the container '${objectDetails.containerName}'.  Error: `,
								err);
						}));
				});
				return Promise.all(downloadPromises);
			})
			.then((allDownloadedObjects) => {
				let objectList = allDownloadedObjects.shift();
				let confidenceMap = {};
				let trainingDataMap = {};
				_.forEach(objectList, (objectDetails) => {
					confidenceMap[objectDetails.objectName] = Math.round(objectDetails.confidence * 10000) / 100;
					trainingDataMap[objectDetails.objectName] = objectDetails.training_data;
				});
				let downloadedObjects = _.filter(allDownloadedObjects, (downloadedObject) => {
					return downloadedObject && _.isObject(downloadedObject);
				});

				if (downloadedObjects.length > 0) {
					robot.emit('ibmcloud.formatter', {
						response: res,
						message: i18n.__('objectstore.search.object')
					});
					let i = 1;
					_.forEach(downloadedObjects, (downloadedObject) => {
						// trainingDataMap[downloadedObject.name]
						robot.logger.debug(`${TAG}: Temp file created for ${downloadedObject.name} at ${downloadedObject.path}`);
						let keywordString = '';
						_.forEach(trainingDataMap[downloadedObject.name], (word) => {
							keywordString += word.toLowerCase() + ', ';
						});
						if (keywordString === '')
							keywordString = 'None';
						else {
							keywordString = keywordString.substring(0, keywordString.length - 2);
						}
						robot.emit('ibmcloud.formatter', {
							response: res,
							fileName: downloadedObject.name,
							filePath: downloadedObject.path,
							message: `${downloadedObject.name}`,
							initial_comment: i18n.__('objectstore.search.object.confidence', confidenceMap[
								downloadedObject.name]) + '\n' + i18n.__('objectstore.search.object.keywords', keywordString)
						});
						i++;
					});
					activity.emitBotActivity(robot, res, {
						activity_id: 'objectstorage.search.object'
					});
				}
				else {
					robot.emit('ibmcloud.formatter', {
						response: res,
						message: i18n.__('objectstore.search.object.no.results')
					});
				}
			})
			.catch((error) => {
				robot.logger.error(
					`${TAG}: Failed to find objects`, error);
				if (error.stack)
					robot.logger.error(
						`${TAG}: Failed to find objects`, error.stack);

				robot.emit('ibmcloud.formatter', {
					response: res,
					message: i18n.__('objectstorage.retrieve.error')
				});
			});
	}
};
