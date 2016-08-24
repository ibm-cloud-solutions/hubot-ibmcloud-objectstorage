// Description:
//	Listens for commands to initiate actions against Bluemix for apps
//
// Configuration:
//
// Commands:
//   hubot objectstorage help - Show available commands in the objectstorage category.
//
// Author:
//	kholdaway
//
/*
 * Licensed Materials - Property of IBM
 * (C) Copyright IBM Corp. 2016. All Rights Reserved.
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */
'use strict';

const path = require('path');
const TAG = path.basename(__filename);
const Helper = require('../lib/paramHelper');
const env = require('../lib/env');


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

const OBJECTSTORAGE_HELP = /objectstorage+(|s)\s+help/i;

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
	}

	// Natural Language match
	robot.on('objectstorage.container.help', (res, parameters) => {
		robot.logger.debug(`${TAG}: Natural Language match.`);
		// Parameter values are obtain through the cognitive/nlc process.
		// Verify that required parameter values were succesfully obtained.
		processObjectStorageHelp(robot, res);
	});

	// Fixed command match
	robot.respond(OBJECTSTORAGE_HELP, {
		id: 'hubot.help'
	}, (res) => {
		processObjectStorageHelp(robot, res);
	});

	// Common code
	function processObjectStorageHelp(robot, res) {
		if (!storage) {
			// Abort.  objectstore.js reported the error to adapter already.
			robot.emit('ibmcloud.formatter', {
				response: res,
				message: i18n.__('objectstorage.missing.envs', helper.getMissingEnv())
			});
			return;
		}

		robot.logger.debug(`${TAG}: Listing help objectstorage...`);

		let help =
			`${robot.name} objectstorage container list - ` + i18n.__('help.objectstorage.container.list') + '\n';
		help += `${robot.name} objectstorage container details <container> - ` + i18n.__(
			'help.objectstorage.container.details') + '\n';
		help += `${robot.name} objectstorage retrieve <container> <object> - ` + i18n.__(
			'help.objectstorage.retrieve.object') + '\n';
		help += `${robot.name} objectstorage search <searchPhrase> - ` + i18n.__(
			'help.objectstorage.search') + '\n';

		robot.emit('ibmcloud.formatter', {
			response: res,
			message: '\n' + help
		});
	}
};
