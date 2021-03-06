// Description:
//	Always listening, waiting to list containers
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
const palette = require('hubot-ibmcloud-utils').palette;
const utils = require('hubot-ibmcloud-utils').utils;
const activity = require('hubot-ibmcloud-activity-emitter');
const nlcconfig = require('hubot-ibmcloud-cognitive-lib').nlcconfig;

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

	const CONTAINER_LIST_PATTERN = /objectstorage\scontainer\slist/i;

	// Natural Language match
	robot.on('objectstorage.container.list', (res, parameters) => {
		robot.logger.debug(`${TAG}: Natural Language match.`);
		// Parameter values are obtain through the cognitive/nlc process.
		// Verify that required parameter values were succesfully obtained.
		processContainerList(robot, res);
	});

	// Fixed command match
	robot.respond(CONTAINER_LIST_PATTERN, {id: 'objectstorage.container.list'}, (res) => {
		processContainerList(robot, res);
	});

	// Common code
	function processContainerList(robot, res) {
		if (!env.initSuccess) {
			// Abort.  objectstore.js reported the error to adapter already.
			robot.emit('ibmcloud.formatter', {
				response: res,
				message: env.initError
			});
			return;
		}

		env.objectStorage.getContainers()
			.then((containers) => {
				const attachments = _.map(containers, (container) => {
					const attachment = {
						title: container.name,
						color: palette.normal
					};
					attachment.fields = [{
						title: 'size',
						value: utils.bytesToSize(container.bytes),
						short: true
					}, {
						title: 'file count',
						value: `${container.count}`,
						short: true
					}];
					return attachment;
				});

				if (attachments.length === 0) {
					robot.logger.debug(`${TAG}: No object storage containers to list.`);
					let message = i18n.__('objectstorage.list.containers.none');
					robot.emit('ibmcloud.formatter', {
						response: res,
						message: message
					});
				}
				else {
					robot.logger.debug(`${TAG}: Listing ${attachments.length} object storage containers.`);
					let message = i18n.__('objectstorage.list.containers');
					robot.emit('ibmcloud.formatter', {
						response: res,
						message: message
					});
					// Emit the app status as an attachment
					robot.emit('ibmcloud.formatter', {
						response: res,
						attachments
					});

					// Add the list of container names to the global cache for Natural Lang.
					let containerNames = containers.map(function(container){
						return container.name;
					});
					nlcconfig.updateGlobalParameterValues('IBMcloudObjectStorage_containername', containerNames);
				}
				activity.emitBotActivity(robot, res, {
					activity_id: 'activity.objectstorage.container.list'
				});
			})
			.catch((error) => {
				robot.logger.error(
					`${TAG}: Failed to list objectstorage containers`, error);
				robot.emit('ibmcloud.formatter', {
					response: res,
					message: i18n.__('objectstorage.list.containers.error')
				});

			});
	}
};
