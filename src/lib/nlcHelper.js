/*
 * Licensed Materials - Property of IBM
 * (C) Copyright IBM Corp. 2016. All Rights Reserved.
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */
'use strict';

const watson = require('watson-developer-cloud');

const NLC_URL = process.env.VCAP_SERVICES_NATURAL_LANGUAGE_CLASSIFIER_0_CREDENTIALS_URL || process.env.HUBOT_WATSON_NLC_URL;
const NLC_USERNAME = process.env.VCAP_SERVICES_NATURAL_LANGUAGE_CLASSIFIER_0_CREDENTIALS_USERNAME || process.env.HUBOT_WATSON_NLC_USERNAME;
const NLC_PASSWORD = process.env.VCAP_SERVICES_NATURAL_LANGUAGE_CLASSIFIER_0_CREDENTIALS_PASSWORD || process.env.HUBOT_WATSON_NLC_PASSWORD;
const NLC_CLASSIFIER = process.env.HUBOT_WATSON_NLC_OJBECTSTORAGE_CLASSIFIER || 'cloudbot-obj-storage-classifier';

/**
 * @param options Object with the following configuration.
 *        options.url = Watson NLC API URL (OPTIONAL, defaults to https://gateway.watsonplatform.net/natural-language-classifier/api)
 *        options.username = Watson NLC username (REQUIRED)
 *        options.password = Watson NLC password (REQUIRED)
 *        options.version = Watson NLC version (OPTIONAL, defaults to V1)
 *        options.language = Watson NLC language (OPTIONAL, defaults to en)
 *        options.classifierName = Watson NLC classifier name (OPTIONAL, defaults to 'default-classifier')
 *        options.maxClassifiers = Maximum number of classifiers with name 'classifierName', will delete classifiers exceding this num (OPTIONAL, defaults to 3)
 *        options.training_data = ReadStream, typically created from a CSV file.  (OPTIONAL, if omitted training data will come from nlcDb)
 * @constructor
 */
function NLCHelper(context) {
	this.opts = {};

	this.initSuccess = false;

	this.missingEnv;
	if (!NLC_URL || NLC_URL.length === 0) {
		this.missingEnv = 'NLC_URL';
	}
	else if (!NLC_USERNAME || NLC_USERNAME.length === 0) {
		this.missingEnv = 'NLC_USERNAME';
	}
	else if (!NLC_PASSWORD || NLC_PASSWORD.length === 0) {
		this.missingEnv = 'NLC_PASSWORD';
	}
	else if (!NLC_CLASSIFIER || NLC_CLASSIFIER.length === 0) {
		this.missingEnv = 'NLC_CLASSIFIER';
	}

	if (!this.missingEnv) {
		this.initSuccess = true;
	}

	this.logger = context.robot.logger;
	if (!this.logger) {
		throw new Error('Logger required when using NLCHelper');
	}

	this.opts = {
		url: NLC_URL,
		username: NLC_USERNAME,
		password: NLC_PASSWORD,
		version: 'v1',
		classifierName: NLC_CLASSIFIER,
		maxClassifiers: 3,
		classifierLanguage: 'en'
	};

	if (!this.missingEnv)
		this.nlc = watson.natural_language_classifier(this.opts);
}

NLCHelper.prototype.initializedSuccessfully = function() {
	return this.initSuccess;
};

NLCHelper.prototype.getMissingEnv = function() {
	return this.missingEnv;
};

/**
 * Returns classification data for a statement using the latest classifier available.
 *
 * @param  String	text	Natural Language statement to be classified.
 * @return JSON      		Classification data from Watson Natural Language Classifier.
 */
NLCHelper.prototype.classify = function(text) {
	var dfd = Promise.defer();
	this._getClassifier().then((classifier) => {
		this.logger.info('Using classifier %s', JSON.stringify(classifier));
		if (classifier.status === 'Training') {
			dfd.resolve(classifier);
		}
		else {
			this.nlc.classify(
				{
					text: text,
					classifier_id: classifier.classifier_id
				},
				(err, response) => {
					if (err) {
						this.classifier_cache = undefined;
						dfd.reject(err);
					}
					else {
						dfd.resolve(response);
					}
				});
		}
	}).catch((err) => {
		this.classifier_cache = undefined;
		dfd.reject(err);
	});
	return dfd.promise;
};

/**
 * Helper method to finds a classifier which is available (training completed)
 * and with the most recent creation date.  If none are 'Available' then find
 * the most recent classifier that started training.  If none are training,
 * start the training.
 *
 * @return Promise When resolved it returns a JSON object with the classifier information.
 */
NLCHelper.prototype._getClassifier = function() {
	var dfd = Promise.defer();

	if (this.classifier_cache) {
		this.logger.debug(`Using cached NLC classifier ${this.classifier_cache.classifier_id}`);
		dfd.resolve(this.classifier_cache);
	}
	else {
		this.nlc.list({}, (err, response) => {
			if (err) {
				this.logger.error('Error getting available classifiers.', err);
				dfd.reject('Error getting available classifiers.' + JSON.stringify(err, null, 2));
			}
			else {
				var filteredClassifiers = response.classifiers.filter((classifier) => {
					return classifier.name === this.opts.classifierName;
				});

				if (filteredClassifiers.length < 1) {
					dfd.reject(`No classifiers found under [${this.opts.classifierName}]`);
				}
				else {
					// try to find the most recent available.  or most recent that started training.
					var sortedClassifiers = filteredClassifiers.sort((a, b) => {
						return new Date(b.created) - new Date(a.created);
					});

					var checkStatus = [];
					sortedClassifiers.map((classifier) => {
						checkStatus.push(this.classifierStatus(classifier.classifier_id));
					});

					Promise.all(checkStatus).then((classifierStatus) => {

						this.classifierTraining = undefined;
						for (var i = 0; i < sortedClassifiers.length; i++) {
							if (sortedClassifiers[i].name === this.opts.classifierName) {
								if (classifierStatus[i].status === 'Available') {
									this.classifier_cache = classifierStatus[i];
									dfd.resolve(classifierStatus[i]);
									return;
								}
								else if (classifierStatus[i].status === 'Training' && !this.classifierTraining) {
									this.classifierTraining = classifierStatus[i];
								}
							}
						}

						if (this.classifierTraining) {
							dfd.resolve(this.classifierTraining);
						}
						else {
							this.logger.error(new Error(`No classifiers available under [${this.opts.classifierName}]`));
							dfd.reject(`No classifiers available under [${this.opts.classifierName}]`);
						}
					}).catch((error) => {
						this.logger.error('Error getting a classifier.', error);
						dfd.reject('Error getting a classifier.' + JSON.stringify(error));
					});
				}
			}
		});
	}
	return dfd.promise;
};

/**
 * Helper method to retrieve the status of a classifier.
 *
 * @param  String 	classifier_id 	The id of the clasifier.
 * @return Promise       			When resolved returns the classifier data.
 */
NLCHelper.prototype.classifierStatus = function(classifier_id) {
	var dfd = Promise.defer();
	if (classifier_id) {
		this.nlc.status({
			classifier_id: classifier_id
		}, (err, status) => {
			if (err) {
				this.logger.error('Error while checking status of classifier ' + classifier_id, err);
				dfd.reject('Error while checking status of classifier ' + classifier_id + JSON.stringify(err, null, 2));
			}
			else {
				// If classifier is Training, record it's training duration
				if (status.status === 'Training') {
					var duration = Math.floor((Date.now() - new Date(status.created)) / 60000);
					status.duration = duration > 0 ? duration : 0;
				}
				this.logger.debug(`Classifier ${classifier_id} status: ${status}`);
				dfd.resolve(status);
			}
		});
	}
	else {
		this.logger.error('classifier_id is a required parameter');
		dfd.reject(new Error('classifier_id is a required parameter'));
	}
	return dfd.promise;
};

module.exports = NLCHelper;
