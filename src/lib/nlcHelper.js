/*
 * Licensed Materials - Property of IBM
 * (C) Copyright IBM Corp. 2016. All Rights Reserved.
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */
'use strict';

const path = require('path');
const TAG = path.basename(__filename);
const watson = require('watson-developer-cloud');
const _ = require('lodash');

/**
 * @param context Object with the following configuration.
 *        context.robot.logger = Hubot Logger
 *        context.settings.nlc_url = Watson NLC API URL (OPTIONAL, defaults to https://gateway.watsonplatform.net/natural-language-classifier/api)
 *        context.settings.nlc_username = Watson NLC username (REQUIRED)
 *        context.settings.nlc_password = Watson NLC password (REQUIRED)
 *        context.nlc_version = Watson NLC version (OPTIONAL, defaults to V1)
 * @constructor
 */
function NLCHelper(context) {
	this.opts = {};

	this.initSuccess = false;

	// Check for missing environment variables
	this.missingEnv;
	if (!context.settings.nlc_url || context.settings.nlc_url.length === 0) {
		this.missingEnv = 'HUBOT_WATSON_NLC_URL';
	}
	else if (!context.settings.nlc_username || context.settings.nlc_username.length === 0) {
		this.missingEnv = 'HUBOT_WATSON_NLC_USERNAME';
	}
	else if (!context.settings.nlc_password || context.settings.nlc_password.length === 0) {
		this.missingEnv = 'HUBOT_WATSON_NLC_PASSWORD';
	}
	else if (!context.settings.nlc_objectstorage_classifier || context.settings.nlc_objectstorage_classifier.length === 0) {
		this.missingEnv = 'HUBOT_WATSON_NLC_OJBECTSTORAGE_CLASSIFIER_NAME';
	}

	if (!this.missingEnv) {
		this.initSuccess = true;
	}

	this.logger = context.robot.logger;
	if (!this.logger) {
		throw new Error('Logger required when using NLCHelper');
	}

	this.opts = {
		url: context.settings.nlc_url,
		username: context.settings.nlc_username,
		password: context.settings.nlc_password,
		version: context.settings.nlc_version,
		classifierName: context.settings.nlc_objectstorage_classifier,
		maxClassifiers: 1,
		classifierLanguage: 'en'
	};

	if (!this.missingEnv)
		this.nlc = watson.natural_language_classifier(this.opts);
}

/**
 * Returns whether the NLCHelper initialized properly.
 *
 * @return Boolean true if the NLCHelper is ready to use
 */
NLCHelper.prototype.initializedSuccessfully = function() {
	return this.initSuccess;
};

/**
 * Returns the missing environment variable that caused the NLCHelper not to initialize properly
 *
 * @return String the missing environment variable that caused the NLCHelper not to initialize properly
 */
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
	let dfd = Promise.defer();
	this._getClassifier().then((classifier) => {
		this.logger.info('Using classifier %s', JSON.stringify(classifier));
		if (classifier.status === 'Training') {
			dfd.reject(new Error('There is not an available classifer at this time.'));
		}
		else {
			this.nlc.classify(
				{
					text: text,
					classifier_id: classifier.classifier_id
				},
				(err, response) => {
					if (err) {
						dfd.reject(err);
					}
					else {
						dfd.resolve(response);
					}
				});
		}
	}).catch((err) => {
		dfd.reject(err);
	});
	return dfd.promise;
};

/**
 * Helper method to finds a classifier which is available (training completed)
 * and with the most recent creation date.
 *
 * @return Promise When resolved it returns a JSON object with the classifier information.
 */
NLCHelper.prototype._getClassifier = function() {
	let dfd = Promise.defer();

	// List all the classifiers
	this.nlc.list({}, (err, response) => {
		if (err) {
			this.logger.error('Error getting available classifiers.', err);
			dfd.reject('Error getting available classifiers.' + JSON.stringify(err, null, 2));
		}
		else {
			// filter out classifiers that have a different name
			let filteredClassifiers = response.classifiers.filter((classifier) => {
				return classifier.name === this.opts.classifierName;
			});

			if (filteredClassifiers.length < 1) {
				dfd.reject(`No classifiers found under [${this.opts.classifierName}]`);
			}
			else {
				let checkStatus = [];
				filteredClassifiers.map((classifier) => {
					checkStatus.push(this.classifierStatus(classifier.classifier_id));
				});

				// Get the status of all classifiers
				Promise.all(checkStatus).then((classifierStatus) => {
					// try to find the most recent available.  or most recent that started training.
					let sortedClassifiers = classifierStatus.sort((a, b) => {
						return new Date(b.created) - new Date(a.created);
					});

					for (let i = 0; i < sortedClassifiers.length; i++) {
						if (sortedClassifiers[i].name === this.opts.classifierName) {
							if (sortedClassifiers[i].status === 'Available') {
								dfd.resolve(sortedClassifiers[i]);
								return;
							}
						}
					}

					this.logger.error(new Error(`No classifiers available under [${this.opts.classifierName}]`));
					dfd.reject(`No classifiers available under [${this.opts.classifierName}]`);
				}).catch((error) => {
					this.logger.error('Error getting a classifier.', error);
					dfd.reject('Error getting a classifier.' + JSON.stringify(error));
				});
			}
		}
	});
	return dfd.promise;
};

/**
 * Helper method to retrieve the status of a classifier.
 *
 * @param  String 	classifier_id 	The id of the clasifier.
 * @return Promise       			When resolved returns the classifier data.
 */
NLCHelper.prototype.classifierStatus = function(classifier_id) {
	let dfd = Promise.defer();
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
					let duration = Math.floor((Date.now() - new Date(status.created)) / 60000);
					status.duration = duration > 0 ? duration : 0;
				}
				this.logger.debug(`${TAG}: Classifier ${classifier_id} status: ` + JSON.stringify(status, null, 2));
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

/**
 *  Method to delete a classifier by id
 *
 * @return Promise Resolves when classifier has been deleted.
 */
NLCHelper.prototype.deleteClassifier = function(classifierIdToDelete) {
	let dfd = Promise.defer();
	this.nlc.remove({
		classifier_id: classifierIdToDelete
	}, (err, result) => {
		if (err) {
			dfd.reject('Error deleting classifier: ' + JSON.stringify(err, null, 2));
		}
		else {
			this.logger.info(`${TAG}: Deleted classifier ${classifierIdToDelete}`);
			dfd.resolve(result);
		}
	});
	return dfd.promise;
};

/**
 *  Method to help with the cleanup of old classifiers.  Will leave a least one classifier in
 * the 'Available' status and one in the 'Training' status.  The newest classifier in each category will remain.
 *
 * @return Promise Resolves when classifiers have been deleted.
 */
NLCHelper.prototype.deleteOldClassifiers = function() {
	let dfd = Promise.defer();
	// List all classifiers
	this.nlc.list({}, (err, response) => {
		if (err) {
			this.logger.error('Error getting available classifiers.', err);
			dfd.reject('Error getting available classifiers. ' + JSON.stringify(err, null, 2));
		}
		else {
			// Filter those that have different names
			let filteredClassifiers = response.classifiers.filter((classifier) => {
				return classifier.name === this.opts.classifierName;
			});

			// Get the status of each classifier
			let statusPromises = [];
			_.forEach(filteredClassifiers, (classifier) => {
				statusPromises.push(this.classifierStatus(classifier.classifier_id));
			});

			Promise.all(statusPromises)
				.then((statusResults) => {
					// Bucket classifiers into the Available and Other bucket
					let activeClassifiers = [];
					let otherClassifiers = [];
					_.forEach(statusResults, (classifierInfo) => {
						if (classifierInfo.status === 'Available') {
							activeClassifiers.push(classifierInfo);
						}
						else {
							otherClassifiers.push(classifierInfo);
						}
					});

					// Sort each bucket by date created
					let sortedAvailableClassifiers = activeClassifiers.sort((a, b) => {
						return new Date(b.created) - new Date(a.created);
					});

					let sortedOtherClassifiers = otherClassifiers.sort((a, b) => {
						return new Date(b.created) - new Date(a.created);
					});

					this.logger.debug(`${TAG}: All available classifiers (sorted by date): ` + JSON.stringify(
						sortedAvailableClassifiers,
						null, 2));
					this.logger.debug(`${TAG}: All unavailable classifiers (sorted by date): ` + JSON.stringify(
						sortedOtherClassifiers,
						null, 2));

					// Remove the latest classifer from each bucket (don't want to delete the latest)
					if (sortedAvailableClassifiers.length > 0) {
						sortedAvailableClassifiers.shift();
					}

					if (sortedOtherClassifiers.length > 0) {
						sortedOtherClassifiers.shift();
					}

					// Merge remaining items from both buckets into a single bucket.  All these can be deleted.
					let classifiersToDelete = _.concat(sortedAvailableClassifiers, sortedOtherClassifiers);

					this.logger.debug(`${TAG}: All old classifiers (to be deleted): ` + JSON.stringify(classifiersToDelete, null,
						2));

					// Delete old classifiers
					let deletePromises = [];
					_.forEach(classifiersToDelete, (classifier) => {
						deletePromises.push(this.deleteClassifier(classifier.classifier_id));
					});

					if (deletePromises.length > 0) {
						Promise.all(deletePromises)
							.then((deleteResults) => {
								dfd.resolve('All old classifiers removed.');
							})
							.catch((err) => {
								dfd.reject(err);
							});
					}
					else {
						dfd.resolve('No old classifiers to remove');
					}
				});
		}
	});
	return dfd.promise;
};

module.exports = NLCHelper;
