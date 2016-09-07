/*
  * Licensed Materials - Property of IBM
  * (C) Copyright IBM Corp. 2016. All Rights Reserved.
  * US Government Users Restricted Rights - Use, duplication or
  * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
  */
'use strict';

const nlcconfig = require('hubot-ibmcloud-cognitive-lib').nlcconfig;
const _ = require('lodash');
const env = require('../lib/env');

const NAMESPACE = 'IBMcloudObjectStorage';
const PARAM_CONTAINERNAME = 'containername';
const PARAM_OBJECTNAMES = 'objectnames';

let functionsRegistered = false;
let storage;


function buildGlobalName(parameterName) {
	return NAMESPACE + '_' + parameterName;
}
function buildGlobalFuncName(parameterName) {
	return NAMESPACE + '_func' + parameterName;
}

function registerEntityFunctions(inStorage) {
	if (!storage) storage = inStorage;
	if (!functionsRegistered) {
		nlcconfig.setGlobalEntityFunction(buildGlobalFuncName(PARAM_CONTAINERNAME), getContainerNames);
		nlcconfig.setGlobalEntityFunction(buildGlobalFuncName(PARAM_OBJECTNAMES), getObjectNames);
		functionsRegistered = true;
	}
}

function getContainerNames(robot, res, parameterName, parameters) {
	return new Promise(function(resolve, reject) {
		if (storage) {
			storage.getContainers().then((result) => {
				let containerNames = result.map(function(container){
					return container.name;
				});
				nlcconfig.updateGlobalParameterValues(buildGlobalName(PARAM_CONTAINERNAME), containerNames);
				resolve(containerNames);
			}).catch(function(err) {
				reject(err);
			});
		}
		else {
			reject(new Error('Object storage environment is not set up properly; unable to retrieve list of containers.'));
		}
	});
}

function getObjectNames(robot, res, parameterName, parameters) {
	return new Promise(function(resolve, reject) {
		if (storage) {
			storage.getContainerDetails(parameters[PARAM_CONTAINERNAME]).then((containerDetails) => {
				let smallerObjects = _.filter(containerDetails.objects, (object) => {
					return object.bytes <= env.max_file_size;
				});
				const objectNames = _.map(smallerObjects, 'name');

				resolve(objectNames);
			}).catch(function(err) {
				reject(err);
			});
		}
		else {
			reject(new Error('Object storage environment is not set up properly; unable to retrieve list of containers.'));
		}
	});
}

module.exports.registerEntityFunctions = registerEntityFunctions;
module.exports.getContainerNames = getContainerNames;
module.exports.getObjectNames = getObjectNames;
