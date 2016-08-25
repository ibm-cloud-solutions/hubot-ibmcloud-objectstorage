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

const env = require('../lib/env');
const Helper = require('../lib/paramHelper');
const path = require('path');
const TAG = path.basename(__filename);
const _ = require('lodash');
const palette = require('hubot-ibmcloud-utils').palette;
const Conversation = require('hubot-conversation');
const utils = require('hubot-ibmcloud-utils').utils;
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
let storage;
module.exports = (robot, res) => {
	if (!helper) {
		helper = new Helper({
			robot: robot,
			res: res,
			settings: env
		});
		if (helper.initializedSuccessfully()) {
			storage = helper.getObjectStorage();
		}
		else {
			storage = undefined;
		}

		// Register entity handling functions
		entities.registerEntityFunctions(storage);
	}

	const switchBoard = new Conversation(robot);

	const CONTAINER_DETAILS_PATTERN = /objectstorage\scontainer\sdetails\s?(.*)?/i;

	// Natural Language match
	robot.on('objectstorage.container.details', (res, parameters) => {
		robot.logger.debug(`${TAG}: Natural Language match.`);
		// Parameter values are obtain through the cognitive/nlc process.
		// Verify that required parameter values were succesfully obtained.
		if (parameters && parameters.containername) {
			processContainerDetails(robot, res, parameters.containername);
		}
		else {
			robot.logger.error(`${TAG}: Error extracting container name from text [${res.message.text}].`);
			robot.emit('ibmcloud.formatter', { response: res, message: i18n.__('cognitive.parse.problem.details') });
		}
	});

	// Fixed command match
	robot.respond(CONTAINER_DETAILS_PATTERN, {id: 'objectstorage.container.details'}, (res) => {
		robot.logger.debug(`${TAG}: res.message.text=${res.message.text}.`);
		processContainerDetails(robot, res, res.match[1]);
	});

	// Common code
	function processContainerDetails(robot, res, containerName) {
		if (!storage) {
			// Abort.  objectstore.js reported the error to adapter already.
			robot.emit('ibmcloud.formatter', {
				response: res,
				message: i18n.__('objectstorage.missing.envs', helper.getMissingEnv())
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
				robot.logger.debug(`${TAG}: Selected ${containerName} for container details command.`);
				return storage.getContainerDetails(containerName);
			})
			.then((containerDetails) => {
				const attachments = _.map(containerDetails.objects, (object) => {
					const attachment = {
						title: object.name,
						color: palette.normal
					};
					attachment.fields = [{
						title: 'size',
						value: utils.bytesToSize(object.bytes),
						short: true
					}, {
						title: 'last modified',
						value: `${object.last_modified}`,
						short: true
					}, {
						title: 'content type',
						value: `${object.content_type}`,
						short: true
					}, {
						title: 'hash',
						value: `${object.hash}`,
						short: true
					}];
					return attachment;
				});

				if (attachments.length === 0) {
					robot.logger.debug(`${TAG}: No object storage objects to list.`);
					let message = i18n.__('objectstore.list.objects.none', containerDetails.name);
					robot.emit('ibmcloud.formatter', {
						response: res,
						message: message
					});
				}
				else {
					robot.logger.debug(`${TAG}: Listing ${attachments.length} object storage objects.`);
					let message = i18n.__('objectstorage.list.objects', containerDetails.name);
					robot.emit('ibmcloud.formatter', {
						response: res,
						message: message
					});
					// Emit the app status as an attachment
					robot.emit('ibmcloud.formatter', {
						response: res,
						attachments
					});
				}
				activity.emitBotActivity(robot, res, {
					activity_id: 'activity.objectstorage.container.details'
				});
			})
			.catch((error) => {
				robot.logger.error(
					`${TAG}: Failed to list objectstorage objects`, error);
				robot.emit('ibmcloud.formatter', {
					response: res,
					message: i18n.__('objectstorage.list.objects.error')
				});

			});
	}
};
