/*
 * Licensed Materials - Property of IBM
 * (C) Copyright IBM Corp. 2016. All Rights Reserved.
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */
'use strict';

const settings = {
	os_auth_url: process.env.HUBOT_OBJECT_STORAGE_AUTH_URL,
	os_user_id: process.env.HUBOT_OBJECT_STORAGE_USER_ID,
	os_password: process.env.HUBOT_OBJECT_STORAGE_PASSWORD,
	os_project_id: process.env.HUBOT_OBJECT_STORAGE_PROJECT_ID,
	os_bluemix_region: process.env.HUBOT_OBJECT_STORAGE_BLUEMIX_REGION || 'dallas',
	nlc_url: process.env.VCAP_SERVICES_NATURAL_LANGUAGE_CLASSIFIER_0_CREDENTIALS_URL || process.env.HUBOT_WATSON_NLC_URL,
	nlc_username: process.env.VCAP_SERVICES_NATURAL_LANGUAGE_CLASSIFIER_0_CREDENTIALS_USERNAME || process.env.HUBOT_WATSON_NLC_USERNAME,
	nlc_password: process.env.VCAP_SERVICES_NATURAL_LANGUAGE_CLASSIFIER_0_CREDENTIALS_PASSWORD || process.env.HUBOT_WATSON_NLC_PASSWORD,
	nlc_objectstorage_classifier: process.env.HUBOT_WATSON_NLC_OJBECTSTORAGE_CLASSIFIER_NAME ||
		'cloudbot-obj-storage-classifier',
	nlc_search_confidence_min: parseFloat(process.env.NLC_SEARCH_CONFIDENCE_MIN) || 0.25,
	nlc_search_result_limit: parseInt(process.env.NLC_SEARCH_RESULT_LIMIT, 10) || 3,
	nlc_classifier_cleanup_interval: parseInt(process.env.NLC_CLASSIFIER_CLEANUP_INTERVAL, 10) || 1000 *
		60 * 60,
	nlc_version: 'v1'
};


// gracefully output message and exit if any required config is undefined
if (!settings.os_auth_url) {
	console.error('HUBOT_OBJECT_STORAGE_AUTH_URL not set');
}

if (!settings.os_user_id) {
	console.error('HUBOT_OBJECT_STORAGE_USER_ID not set');
}

if (!settings.os_password) {
	console.error('HUBOT_OBJECT_STORAGE_PASSWORD not set');
}

if (!settings.os_project_id) {
	console.error('HUBOT_OBJECT_STORAGE_PROJECT_ID not set');
}

if (!settings.os_bluemix_region) {
	console.error('HUBOT_OBJECT_STORAGE_BLUEMIX_REGION not set');
}

if (!settings.nlc_url) {
	console.log('HUBOT_WATSON_NLC_URL not set');
}

if (!settings.nlc_username) {
	console.log('HUBOT_WATSON_NLC_USERNAME not set');
}
if (!settings.nlc_password) {
	console.log('HUBOT_WATSON_NLC_PASSWORD not set');
}

if (!settings.nlc_objectstorage_classifier) {
	console.log('HUBOT_WATSON_NLC_OJBECTSTORAGE_CLASSIFIER_NAME not set');
}

module.exports = settings;
