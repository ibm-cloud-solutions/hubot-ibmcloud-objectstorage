/*
  * Licensed Materials - Property of IBM
  * (C) Copyright IBM Corp. 2016. All Rights Reserved.
  * US Government Users Restricted Rights - Use, duplication or
  * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
  */
'use strict';

const nlcconfig = require('hubot-ibmcloud-cognitive-lib').nlcconfig;

const NAMESPACE = 'IBMcloudObjectStorage';
const PARAM_CONTAINERNAME = 'containername';

var functionsRegistered = false;
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
		functionsRegistered = true;
	}
}

function getContainerNames(robot, res, parameterName, parameters) {
	return new Promise(function(resolve, reject) {
		if (storage) {
			storage.getContainers().then((result) => {
				var containerNames = result.map(function(container){
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

module.exports.registerEntityFunctions = registerEntityFunctions;
module.exports.getContainerNames = getContainerNames;
