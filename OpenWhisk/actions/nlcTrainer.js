/*
 * Licensed Materials - Property of IBM
 * (C) Copyright IBM Corp. 2016. All Rights Reserved.
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */
/*eslint strict: ["off", "global"]*/
function main(params) {
	'use strict';  // OpenWhisk can't resolve main function if strict mode is enabled at global scope.
	/**
	 *  Action to train NLC instance using image metadata that BluePics stores in cloudant.
	 *
	 *  @param {string} cloudantUsername (required) - cloudant user used for BluePic
	 *  @param {string} cloudantPassword (required) - cloudant password used for BluePic
	 *  @param {string} cloudantDbName (required) - cloudant database name used for BluePic
	 *  @param {string} nlcUsername (required) - username for NLC
	 *  @param {string} nlcPassword (required) - password for NLC
	 *  @param {string} nlcUrl (required) - URL for NLC
	 *  @param {string} nlcClassifier (optional) - Name used for classifier associated with this action.
	 *  @param {string} logLevel (optional) - Set the log level used for this action.  Default is INFO.
	 *  @param {string} nlcForceTraining (optional) - Set to "true" to skip training checks and force NLC training
	 *  @param {string} NLC_LIMIT_NUM_CLASSES (optional) - Max # of class to train NLC with.
	 *  @param {string} NLC_LIMIT_TEXT_LENGTH (optional) - Max length of training data statement.
	 *  @param {string} NLC_LIMIT_MIN_RECORDS (optional) - Minimum # of training data records needed to train NLC.
	 *  @param {string} NLC_LIMIT_MAX_RECORDS (optional) - Max # of records that can be used to train NLC.
	 *
	 */
	const watson = require('watson-developer-cloud');
	const Cloudant = require('cloudant');

	const log4js = require('log4js');
	log4js.configure({
		appenders: [
			{ type: 'console' }
		]
	});
	const logger = log4js.getLogger();
	logger.setLevel(params.logLevel || 'INFO');

	const TAG = 'nlcTrainer';
	const classifierName = params.nlcClassifier || 'cloudbot-obj-storage-classifier';

	let trainingFrequency = 60 * 60 * 1000; // default for 1 hour minimum between training
	let nlc;
	let cloudantDb;
	let resultSummary = {};

	// This promise is the returned to OpenWhisk and implements the main flow.
	return new Promise((resolve, reject) => {
		if (validateParams()) {
			nlc = watson.natural_language_classifier({
				url: params.nlcUrl,
				username: params.nlcUsername,
				password: params.nlcPassword,
				version: 'v1'
			});

			cloudantDb = Cloudant({ account: params.cloudantUsername, password: params.cloudantPassword}).db.use(params.cloudantDbName);

			let existingClassifiers = [];

			getExistingClassifiers().then((classifiers) => {
				existingClassifiers = classifiers;

				if (shouldTrain(existingClassifiers)) {
					return trainNewClassifier();
				}
				else {
					return Promise.resolve();
				}
			}).then(() => {
				return cleanupOldClassifiers(existingClassifiers);
			}).then(() => {
				resolve(resultSummary);
			}).catch((error) => {
				reject(error);
			});
		}
		else {
			reject(`${TAG} Missing required params.`);
		}
	});

	// True if all required params are set, else false.
	function validateParams() {
		const required = [
			'cloudantUsername', 'cloudantPassword', 'cloudantDbName',
			'nlcUsername', 'nlcPassword', 'nlcUrl'
		];

		let allValid = true;

		// Print params for debugging
		for (let element in params) {
			logger.debug(`${TAG}: param key: ${element} value: ${JSON.stringify(params[element])}`);
		}

		required.forEach((element) => {
			if (!params[element] || !params[element].length) {
				logger.info(`${TAG}: Missing required param: ${element}`);
				allValid = false;
			}
		});

		return allValid;
	}

	// Retrieve and set status field.
	function setClassifierInfo(classifier) {
		return new Promise((resolve, reject) => {
			nlc.status({classifier_id: classifier.classifier_id}, (err, status) => {
				if (err) {
					reject(err);
				}
				else {
					classifier.status = status.status;
					resolve();
				}
			});
		});
	}

	// Resolved with array of classifiers that are sorted in descending order by creation data.
	// Also makes additional request needed to get the status of each classifier.
	function getExistingClassifiers() {
		return new Promise((resolve, reject) => {
			nlc.list({}, (err, response) => {
				if (err) {
					reject(err);
				}
				else {
					let classifiers = response.classifiers.sort((a, b) => {
						return new Date(b.created) - new Date(a.created);
					});

					classifiers = classifiers.filter((classifier) => {
						return classifier.name === classifierName;
					});

					if (!classifiers.length) {
						resolve(classifiers);
					}
					else {
						let promises = [];

						classifiers.forEach((classifier) => {
							promises.push(setClassifierInfo(classifier));
						});

						Promise.all(promises).then(() => {
							logger.info(`${TAG}: found the following ${classifiers.length} existing classifiers.`);

							classifiers.forEach((classifier) => {
								logger.info(`${TAG}: ${JSON.stringify(classifier)}`);
							});

							resolve(classifiers);
						}).catch((error) => {
							reject(error);
						});
					}
				}
			});
		});
	}

	// Decides if we should train.  Decision is based on the fact that we haven't created a new classifier in a while
	// and no other classifier is currently training.
	function shouldTrain(existingClassifiers) {
		let shouldTrain = false;

		if (params.nlcForceTraining === 'true') {
			logger.info(`${TAG}: should train, because force training flag is set.`);
			shouldTrain = true;
		}
		else {
			// The cloudant feed OpenWhisk trigger includes doc, so _id and _rev will be set when triggered by cloudant.
			// The additional checks are making sure that the doc is an image and the image has tags.
			// Needed b/c BluePic first creates the image without tags, then updates it.  Without this check we
			// would trigger training before the tags are added.
			if ((params._id && params._rev) && (params.type !== 'image' || !params.tags)) {
				logger.info(`${TAG}: should not train, because no new image tags are included in the cloudant doc.`);
			}
			else if (!existingClassifiers.length) {
				logger.info(`${TAG}: should train, because there are no preexisting classifiers.`);
				shouldTrain = true;
			}
			else {
				let mostRecent = existingClassifiers[0];
				let timeDiff = new Date() - new Date(mostRecent.created);

				if (timeDiff < trainingFrequency) {
					logger.info(`${TAG}: should not train, because training frequency was not exceeded.  Last trained: ${mostRecent.created}`);
				}
				else {
					let alreadyTraining = false;
					existingClassifiers.forEach((classifier) => {
						if (classifier.status === 'Training') {
							alreadyTraining = true;
						}
					});

					if (alreadyTraining) {
						logger.info(`${TAG}: should not train, because classifier is already training.`);
					}
					else {
						logger.info(`${TAG}: should train, because all conditions are met.`);
						shouldTrain = true;
					}
				}
			}
		}

		resultSummary.shouldTrain = shouldTrain;
		return shouldTrain;
	}

	// Adds training data to the provided array using the provided URL segments to generate the class.
	// Format supported by nlc train: '[{ text: "my-text", classes:["my-class1", "my-class2",...]}, {}, ...]'
	function addTrainingData(docId, array, url_segments, training_text) {
		let NLC_LIMIT_TEXT_LENGTH = params.NLC_LIMIT_TEXT_LENGTH || 1024;

		if (!training_text || !training_text.length) {
			logger.warn(`${TAG}: WARNING - omitting empty training text.  Cloudant doc id: ${docId}`);
			return;
		}
		else if (training_text.length > NLC_LIMIT_TEXT_LENGTH) {
			logger.warn(`${TAG}: WARNING - image tag too long to use with NLC.  Cloudant doc id: ${docId}`);
			return;
		}

		let nlcClass = '/' + url_segments.slice(-2).join('/'); // take last 2 segments for BluePic generated URL.
		let trainingStatement = {
			text: training_text,
			classes: [nlcClass]
		};

		logger.debug(`${TAG}: ${JSON.stringify(trainingStatement)} - ${docId}`);
		array.push(trainingStatement);
	}

	// Retrieve image metdata that BluePic stores in cloudant and construct training data for NLC.
	// NOTE: This method is very specific to BluePic app.
	function getTrainingData() {
		return new Promise((resolve, reject) => {
			logger.info(`${TAG}: retrieving metadata from cloudant to generate training data...`);

			let trainingData = [];

			// NLC has several limits regarding training data.  see: https://www.ibm.com/watson/developercloud/doc/nl-classifier/data_format.shtml
			let NLC_LIMIT_NUM_CLASSES = params.NLC_LIMIT_NUM_CLASSES || 500;
			let NLC_LIMIT_MIN_RECORDS = params.NLC_LIMIT_MIN_RECORDS || 5;
			let NLC_LIMIT_MAX_RECORDS = params.NLC_LIMIT_MAX_RECORDS || 15000;

			let options = {
				limit: NLC_LIMIT_NUM_CLASSES * 2,  // times 2 because the view includes the image and user docs.
				include_docs: true
			};

			// This is a view provided by BluePic, it returns 2 type of objects: the image object and the user object for each image.
			cloudantDb.view('main_design', 'images', options, function(err, body) {
				if (err) {
					reject(err);
				}
				else {
					if (body.total_rows > options.limit) {
						logger.warn(`${TAG}: WARNING - cloudant contains more image than supported for NLC training.  NLC will not be trained for all images.`);
					}

					let imageDocs = body.rows.filter((element) => {
						return element.doc && element.doc.type === 'image' && element.doc.tags && element.doc.tags.length;
					});

					imageDocs = imageDocs.map((element) => {
						return element.doc;
					});

					if (!imageDocs.length) {
						reject('no image metadata to use for NLC training');
						return;
					}
					else if (imageDocs.length > NLC_LIMIT_NUM_CLASSES) {
						logger.warn(`${TAG}: WARNING - cloudant returned more image than supported for NLC training.  NLC will not be trained for all images.`);
						imageDocs = imageDocs.slice(0, NLC_LIMIT_NUM_CLASSES);
					}

					imageDocs.forEach(function(doc) {
						let url_segments;

						if (doc.url) {
							url_segments = doc.url.split('/');
						}

						if (!url_segments || url_segments.length < 2) {
							logger.warn(`${TAG}: WARNING - image metadata in cloudant does not have valid url.  Cloudant doc id: ${doc._id}`);
						}
						else {
							// Include training data from different doc fields of interest.
							if (doc.caption) {
								addTrainingData(doc._id, trainingData, url_segments, doc.caption);
							}

							if (doc.location && doc.location.name) {
								addTrainingData(doc._id, trainingData, url_segments, doc.location.name);
							}

							doc.tags.forEach((tag) => {
								addTrainingData(doc._id, trainingData, url_segments, tag.label);
							});
						}
					});

					if (trainingData.length < NLC_LIMIT_MIN_RECORDS) {
						reject('not enough training records to use with NLC');
						return;
					}
					else if (trainingData.length > NLC_LIMIT_MAX_RECORDS) {
						logger.warn(`${TAG}: WARNING - ${trainingData.length} is too many records for NLC.  Limiting to ${NLC_LIMIT_MAX_RECORDS} training records.`);
						trainingData = trainingData.slice(0, NLC_LIMIT_MAX_RECORDS);
					}

					resolve(trainingData);
				}
			});
		});
	}

	// Gather the data needed to train a new classifier and start training.
	function trainNewClassifier() {
		return new Promise((resolve, reject) => {
			getTrainingData().then((trainingData) => {
				logger.info(`${TAG}: training new classifier - ${classifierName} with ${trainingData.length} training records...`);

				let options = {
					language: 'en',
					name: classifierName,
					training_data: trainingData
				};

				nlc.create(options, (err, response) => {
					if (err) {
						reject(err);
					}
					else {
						logger.info(`${TAG}: training started for classifier: ${JSON.stringify(response)}`);
						resultSummary.training = true;
						resolve();
					}
				});
			}).catch((error) => {
				reject(error);
			});
		});
	}

	// Deletes an old classifier.
	function deleteClassifier(classifier) {
		return new Promise((resolve, reject) => {
			nlc.remove({classifier_id: classifier.classifier_id}, (err, status) => {
				if (err) {
					reject(err);
				}
				else {
					logger.info(`${TAG}: successfully deleted old classifier: ${classifier.name}`);
					resolve();
				}
			});
		});
	}

	// Delete anything other than the most recent classifier training and the most recent classifier
	// that's already available.  These are the two that the cloudbot script will be interested in.
	// With this logic in place, at most only 2 classifiers will exist.
	function cleanupOldClassifiers(existingClassifiers) {
		return new Promise((resolve, reject) => {
			let oldClassifiers = [];
			let mostRecentTraining;
			let mostRecentAvailable;

			for (let i = 0; i < existingClassifiers.length; ++i) {
				let classifier = existingClassifiers[i];
				if (!mostRecentTraining && classifier.status === 'Training') {
					mostRecentTraining = classifier;
				}
				else if (!mostRecentAvailable && classifier.status === 'Available') {
					mostRecentAvailable = classifier;
				}
				else {
					oldClassifiers.push(classifier);
				}
			}

			resultSummary.cleanup = oldClassifiers.length;
			if (!oldClassifiers.length) {
				logger.info(`${TAG}: no classifiers to cleanup.`);
				resolve();
			}
			else {
				logger.info(`${TAG}: found ${oldClassifiers.length} to cleanup.`);

				let promises = [];

				oldClassifiers.forEach((classifier) => {
					promises.push(deleteClassifier(classifier));
				});

				Promise.all(promises).then(() => {
					resolve();
				}).catch((error) => {
					reject(error);
				});
			}
		});
	}
}

// Allows us to run this code locally (outside OpenWhisk) via setting localRun env var.
if (process.env.localRun === 'true') {
	main(process.env).then((result) => {
		console.log(JSON.stringify(result, null, 2));
	}).catch((error) => {
		console.error(error);
	});
}

// Allows automated test to treat this action as a node module.
if (process.env.HUBOT_AUTOMATED_TEST === 'true') {
	module.exports = {
		main: main
	};
}
