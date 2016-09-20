/*
 * Licensed Materials - Property of IBM
 * (C) Copyright IBM Corp. 2016. All Rights Reserved.
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */
'use strict';

const ObjectStorage = require('hubot-ibmcloud-objectstorage-crawler').objectstorage;
const SearchEngine = require('hubot-ibmcloud-objectstorage-crawler').osSearchEngine;

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

function init() {
	let storage = new ObjectStorage();
	let initError;
	if (!storage.initializedSuccessfully()) {
		initError = i18n.__('objectstorage.missing.envs', storage.missingEnv);
		storage = undefined;
	}

	let searchEngine = new SearchEngine();

	if (!searchEngine.initializedSuccessfully()) {
		initError = searchEngine.initializationError();
		searchEngine = undefined;
	}

	let tempEnv = {
		nlc_search_diff_confidence_max: parseFloat(process.env.HUBOT_OBJECT_STORAGE_SEARCH_DIFF_CONFIDENCE_MAX) || 0.5,
		max_file_size: (1024 * 1024),
		supported_adapters: ['slack', 'shell']
	};

	if (storage && searchEngine) {
		tempEnv.initSuccess = true;
		tempEnv.objectStorage = storage;
		tempEnv.searchEngine = searchEngine;
	}
	else {
		tempEnv.initSuccess = false;
		tempEnv.initError = initError;
	}

	return tempEnv;
}

let env = init();

module.exports = env;
