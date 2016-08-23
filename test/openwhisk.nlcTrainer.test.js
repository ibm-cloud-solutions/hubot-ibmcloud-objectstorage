/*
 * Licensed Materials - Property of IBM
 * (C) Copyright IBM Corp. 2016. All Rights Reserved.
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */
'use strict';

const path = require('path');
const expect = require('chai').expect;
const nock = require('nock');

process.env.localRun = 'true';
const nlcTrainer = require('../OpenWhisk/actions/nlcTrainer.js');

// Fake end-points specific to this test, so they don't conflict with other test.
const nlcEndpoint = 'https://whisk.test.nlc.com';
const cloudantEndpoint = 'https://user1.cloudant.com'; // must match username

const cloudantViewResponse = require(path.resolve(__dirname, 'resources', 'cloudant.images.view.json'));

describe('Testing OpenWhisk action to train NLC using BluePic Cloudant metadata.', function() {

	var params;

	before(function() {
		nock.disableNetConnect();
	});

	beforeEach(function() {
		params = {
			logLevel: 'INFO',
			nlcUrl: nlcEndpoint,
			nlcUsername: 'user1',
			nlcPassword: 'password',
			cloudantHost: cloudantEndpoint,
			cloudantDbName: 'bluepic_db',
			cloudantUsername: 'user1',
			cloudantPassword: 'password'
		};
	});

	function getClassifierListEntry(classifierId, classifierDate) {
		return {
			classifier_id: classifierId,
			url: nlcEndpoint + '/v1/classifiers/' + classifierId,
			name: 'cloudbot-obj-storage-classifier',
			language: 'en',
			created: classifierDate.toString()
		};
	}

	function getClassifierDetailEntry(classifierListEntry, classifierStatus) {
		var classifierDetailEntry = JSON.parse(JSON.stringify(classifierListEntry));
		classifierDetailEntry.status = classifierStatus;
		return classifierDetailEntry;
	}

	function stripNlcEndpoint(nlcFullPath) {
		if (nlcFullPath && nlcFullPath.indexOf(nlcEndpoint) === 0) {
			return nlcFullPath.substring(nlcEndpoint.length);
		}

		return nlcFullPath;
	}

	context('whisk action runs with missing params', function() {

		it('should fail with missing params', function(done) {

			delete params.nlcUrl;

			nlcTrainer.main(params).then((result) => {
				done('Promise should have been rejected due to missing params');
			}).catch((error) => {
				expect(error).to.contain('Missing required params');
				done();
			});
		});

	});

	context('whisk action should not train', function() {

		it('should not train when already training', function(done) {

			let classifier1 = getClassifierListEntry('classifier-id-1', new Date(111));

			nock(nlcEndpoint).get('/v1/classifiers').reply(200, function() {
				var response = {
					classifiers: []
				};

				response.classifiers.push(classifier1);
				return response;
			});

			nock(nlcEndpoint).get(stripNlcEndpoint(classifier1.url)).reply(200, function() {
				return getClassifierDetailEntry(classifier1, 'Training');
			});

			nlcTrainer.main(params).then((result) => {
				expect(result.shouldTrain).to.be.false;
				done();
			}).catch((error) => {
				done(error);
			});
		});

		it('should not train when training frequency is not exceeded', function(done) {

			let classifier1 = getClassifierListEntry('classifier-id-1', new Date());

			nock(nlcEndpoint).get('/v1/classifiers').reply(200, function() {
				var response = {
					classifiers: []
				};

				response.classifiers.push(classifier1);
				return response;
			});

			nock(nlcEndpoint).get(stripNlcEndpoint(classifier1.url)).reply(200, function() {
				return getClassifierDetailEntry(classifier1, 'Available');
			});

			nlcTrainer.main(params).then((result) => {
				expect(result.shouldTrain).to.be.false;
				done();
			}).catch((error) => {
				done(error);
			});
		});

		it('should not train when not a cloudant image doc', function(done) {

			params._id = 'fake-id';
			params._rev = 'fake-rev';
			params.type = 'user'; // not an image.
			params.tags = [{ tag1: 'fake' }];

			nock(nlcEndpoint).get('/v1/classifiers').reply(200, function() {
				var response = {
					classifiers: []
				};
				return response;
			});

			nlcTrainer.main(params).then((result) => {
				expect(result.shouldTrain).to.be.false;
				done();
			}).catch((error) => {
				done(error);
			});
		});

		it('should not train when cloudant doc does not contain tags', function(done) {

			params._id = 'fake-id';
			params._rev = 'fake-rev';
			params.type = 'image';
			// params.tags = [{tag1:'fake'}];

			nock(nlcEndpoint).get('/v1/classifiers').reply(200, function() {
				var response = {
					classifiers: []
				};
				return response;
			});

			nlcTrainer.main(params).then((result) => {
				expect(result.shouldTrain).to.be.false;
				done();
			}).catch((error) => {
				done(error);
			});
		});

	});

	context('whisk action should train', function() {

		it('should train when force training flag is set', function(done) {

			nock(cloudantEndpoint).get('/bluepic_db/_design/main_design/_view/images').query(true).reply(200, function() {
				return cloudantViewResponse;
			});

			let classifier1 = getClassifierListEntry('classifier-id-1', new Date(111));

			nock(nlcEndpoint).post('/v1/classifiers').reply(201, function() {
				return getClassifierDetailEntry(getClassifierListEntry('classifier-id-new', new Date()), 'Training');
			});

			nock(nlcEndpoint).get('/v1/classifiers').reply(200, function() {
				var response = {
					classifiers: []
				};

				response.classifiers.push(classifier1);
				return response;
			});

			nock(nlcEndpoint).get(stripNlcEndpoint(classifier1.url)).reply(200, function() {
				return getClassifierDetailEntry(classifier1, 'Training');
			});

			// we have a training classifier, but setting flag to force training
			params.nlcForceTraining = 'true';

			nlcTrainer.main(params).then((result) => {
				expect(result.shouldTrain).to.be.true;
				expect(result.training).to.be.true;
				done();
			}).catch((error) => {
				done(error);
			});
		});

		it('should train when no preexisting classifiers', function(done) {

			nock(cloudantEndpoint).get('/bluepic_db/_design/main_design/_view/images').query(true).reply(200, function() {
				return cloudantViewResponse;
			});

			nock(nlcEndpoint).post('/v1/classifiers').reply(201, function() {
				return getClassifierDetailEntry(getClassifierListEntry('classifier-id-new', new Date()), 'Training');
			});

			nock(nlcEndpoint).get('/v1/classifiers').reply(200, function() {
				return {
					classifiers: []
				};
			});

			nlcTrainer.main(params).then((result) => {
				expect(result.shouldTrain).to.be.true;
				expect(result.training).to.be.true;
				done();
			}).catch((error) => {
				done(error);
			});
		});

		it('should train when all preconditions are met', function(done) {

			nock(cloudantEndpoint).get('/bluepic_db/_design/main_design/_view/images').query(true).reply(200, function() {
				return cloudantViewResponse;
			});

			let classifier1 = getClassifierListEntry('classifier-id-1', new Date(111));

			nock(nlcEndpoint).post('/v1/classifiers').reply(201, function() {
				return getClassifierDetailEntry(getClassifierListEntry('classifier-id-new', new Date()), 'Training');
			});

			nock(nlcEndpoint).get('/v1/classifiers').reply(200, function() {
				var response = {
					classifiers: []
				};

				// Will return a single classifier that's already available.  Hence training should still happen.
				response.classifiers.push(classifier1);
				return response;
			});

			nock(nlcEndpoint).get(stripNlcEndpoint(classifier1.url)).reply(200, function() {
				return getClassifierDetailEntry(classifier1, 'Available');
			});

			// Inidicate the training is triggered by cloudant doc change with all required params.
			params._id = 'fake-id';
			params._rev = 'fake-rev';
			params.type = 'image';
			params.tags = [{ tag1: 'fake' }];

			nlcTrainer.main(params).then((result) => {
				expect(result.shouldTrain).to.be.true;
				expect(result.training).to.be.true;
				done();
			}).catch((error) => {
				done(error);
			});
		});
	});

	context('whisk action should delete old classifiers', function() {

		it('should delete 2 oldest classifiers', function(done) {

			let classifier1 = getClassifierListEntry('classifier-id-1', new Date(1111111111));
			let classifier2 = getClassifierListEntry('classifier-id-2', new Date(2222222222));
			let classifier3 = getClassifierListEntry('classifier-id-3', new Date(3333333333));
			let classifier4 = getClassifierListEntry('classifier-id-4', new Date(4444444444));

			nock(nlcEndpoint).get('/v1/classifiers').reply(200, function() {
				var response = {
					classifiers: []
				};

				// Added out of order to ensure nlcTrainer sorts them and finds the 2 oldest.
				response.classifiers.push(classifier1);
				response.classifiers.push(classifier4);
				response.classifiers.push(classifier2);
				response.classifiers.push(classifier3);
				return response;
			});

			// status of individual classifiers.
			nock(nlcEndpoint).get(stripNlcEndpoint(classifier1.url)).reply(200, function() {
				return getClassifierDetailEntry(classifier1, 'Available');
			});
			nock(nlcEndpoint).get(stripNlcEndpoint(classifier2.url)).reply(200, function() {
				return getClassifierDetailEntry(classifier2, 'Available');
			});
			nock(nlcEndpoint).get(stripNlcEndpoint(classifier3.url)).reply(200, function() {
				return getClassifierDetailEntry(classifier3, 'Available');
			});
			nock(nlcEndpoint).get(stripNlcEndpoint(classifier4.url)).reply(200, function() {
				return getClassifierDetailEntry(classifier4, 'Training');
			});

			// delete routes for the 2 we expect to be deleted.
			var deletedClassifier1 = false;
			var deletedClassifier2 = false;

			nock(nlcEndpoint).delete(stripNlcEndpoint(classifier1.url)).reply(200, function() {
				deletedClassifier1 = true;
				return {};
			});
			nock(nlcEndpoint).delete(stripNlcEndpoint(classifier2.url)).reply(200, function() {
				deletedClassifier2 = true;
				return {};
			});

			nlcTrainer.main(params).then((result) => {
				expect(result.shouldTrain).to.be.false;
				expect(result.cleanup).to.eq(2);
				expect(deletedClassifier1).to.be.true;
				expect(deletedClassifier2).to.be.true;
				done();
			}).catch((error) => {
				done(error);
			});
		});
	});

	context('exercise NLC limits', function() {

		it('should train when classes in repo exceed NLC limit', function(done) {

			nock(cloudantEndpoint).get('/bluepic_db/_design/main_design/_view/images').query(true).reply(200, function() {
				return cloudantViewResponse;
			});

			nock(nlcEndpoint).post('/v1/classifiers').reply(201, function() {
				return getClassifierDetailEntry(getClassifierListEntry('classifier-id-new', new Date()), 'Training');
			});

			nock(nlcEndpoint).get('/v1/classifiers').reply(200, function() {
				return {
					classifiers: []
				};
			});

			// Set very low # of class to train NLC with.
			params.NLC_LIMIT_NUM_CLASSES = 2;

			nlcTrainer.main(params).then((result) => {
				expect(result.shouldTrain).to.be.true;
				expect(result.training).to.be.true;
				done();
			}).catch((error) => {
				done(error);
			});
		});

		it('should train even when there are too many records', function(done) {

			nock(cloudantEndpoint).get('/bluepic_db/_design/main_design/_view/images').query(true).reply(200, function() {
				return cloudantViewResponse;
			});

			nock(nlcEndpoint).post('/v1/classifiers').reply(201, function() {
				return getClassifierDetailEntry(getClassifierListEntry('classifier-id-new', new Date()), 'Training');
			});

			nock(nlcEndpoint).get('/v1/classifiers').reply(200, function() {
				return {
					classifiers: []
				};
			});

			// Set max allowed training records really low
			params.NLC_LIMIT_MAX_RECORDS = 10;

			nlcTrainer.main(params).then((result) => {
				expect(result.shouldTrain).to.be.true;
				expect(result.training).to.be.true;
				done();
			}).catch((error) => {
				done(error);
			});
		});

		it('should not train if not enough training records', function(done) {

			nock(cloudantEndpoint).get('/bluepic_db/_design/main_design/_view/images').query(true).reply(200, function() {
				return cloudantViewResponse;
			});

			nock(nlcEndpoint).get('/v1/classifiers').reply(200, function() {
				return {
					classifiers: []
				};
			});

			// Set very high # of minimum training records.
			params.NLC_LIMIT_MIN_RECORDS = 50000;

			nlcTrainer.main(params).then((result) => {
				done('action should have been rejected due to not enough NLC training records');
			}).catch((error) => {
				expect(error).to.contain('not enough training records to use with NLC');
				done();
			});
		});
	});
});
