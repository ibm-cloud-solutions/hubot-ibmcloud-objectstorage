/*
 * Licensed Materials - Property of IBM
 * (C) Copyright IBM Corp. 2015. All Rights Reserved.
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */

'use strict';

const env = require('../lib/env');
const path = require('path');
const TAG = path.basename(__filename);
const _ = require('lodash');
const utils = require('hubot-ibmcloud-utils').utils;

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

function ParamHelper(options) {
	this.robot = options.robot;
	this.res = options.res;
	return this;
}

ParamHelper.prototype.initializedSuccessfully = function() {
	return env.initSuccess;
};

ParamHelper.prototype.initializationError = function() {
	return env.initError;
};

ParamHelper.prototype.isAdapterSupported = function(adapterName) {
	return _.indexOf(env.supported_adapters, adapterName) !== -1;
};

ParamHelper.prototype.createRangeRegEx = function(start, end) {
	let pattern = '\\b(';
	let i;
	for (i = start; i < end; i++) {
		pattern += i + '|';
	}
	pattern += end + ')\\b';
	return new RegExp(pattern);
};

ParamHelper.prototype.createPromptForSelection = function(context, choices, promptDescription) {
	if (!this.initializedSuccessfully()) {
		return Promise.reject(env.initError);
	}

	let choiceString = '';
	let choiceArray = _.cloneDeep(choices);
	choiceArray.push(i18n.__('objectstorage.select.none.option'));

	let count = 0;
	_.forEach(choiceArray, (choice) => {
		choiceString += ++count + '. ' + choice + '\n';
	});

	let prompt = promptDescription + '\n' + choiceString;

	const regex = this.createRangeRegEx(1, count);
	context.robot.logger.debug(`${TAG}: selection regex: ${regex}`);

	return utils.getExpectedResponse(context.res, context.robot, context.switchBoard, prompt, regex)
		.then((selectionRes) => {
			let selection = parseInt(selectionRes.match[1], 10) - 1;
			let selectedChoice = choiceArray[selection];
			if (selection === (count - 1)) {
				return new Error('No selection made.'); // Text not surfaced to the user
			}
			context.robot.logger.debug(`${TAG}: Selected ${selectedChoice}.`);
			return selectedChoice;
		});
};

ParamHelper.prototype.obtainContainerName = function(context, inputName) {
	if (!this.initializedSuccessfully()) {
		return Promise.reject(env.initError);
	}

	return env.objectStorage.getContainers()
		.then((containers) => {
			const containerNames = _.map(containers, 'name');
			if (inputName && inputName.length > 0) {
				if (_.indexOf(containerNames, inputName) !== -1) {
					return Promise.resolve(inputName);
				}
				else {
					let message = i18n.__('objectstorage.container.not.found', inputName);
					context.robot.emit('ibmcloud.formatter', {
						response: context.res,
						message: message
					});
				}
			}

			if (containers.length === 0) {
				return Promise.reject(new Error(i18n.__('objectstorage.list.containers.none')));
			}

			// Container not found so prompt for one.
			return this.createPromptForSelection(context, containerNames, i18n.__('objectstorage.container.prompt.select'));
		});
};

ParamHelper.prototype.obtainObjectName = function(context, containerName, originalInputName) {
	if (!this.initializedSuccessfully()) {
		return Promise.reject(env.initError);
	}

	let result = {
		containerName: containerName
	};
	return env.objectStorage.getContainerDetails(containerName)
		.then((containerDetails) => {
			let smallerObjects = _.filter(containerDetails.objects, (object) => {
				return object.bytes <= env.max_file_size;
			});
			const objectNames = _.map(smallerObjects, 'name');
			if (originalInputName && originalInputName.length > 0) {
				let inputName = originalInputName.trim();
				if (_.indexOf(objectNames, inputName) !== -1) {
					return Promise.resolve(inputName);
				}
				else {
					let message = i18n.__('objectstorage.object.not.found', inputName);
					context.robot.emit('ibmcloud.formatter', {
						response: context.res,
						message: message
					});
				}
			}

			if (objectNames.length === 0) {
				return Promise.reject(new Error(i18n.__('objectstorage.list.objects.none')));
			}

			// Container not found so prompt for one.
			return this.createPromptForSelection(context, objectNames, i18n.__('objectstorage.object.prompt.select'));

		})
		.then((selectedObject) => {
			if (_.isError(selectedObject))
				return Promise.reject(selectedObject);
			result.objectName = selectedObject;
			return result;
		});
};

exports = module.exports = ParamHelper;
