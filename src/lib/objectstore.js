/*
 * Licensed Materials - Property of IBM
 * (C) Copyright IBM Corp. 2015. All Rights Reserved.
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */

'use strict';

const request = require('request');
const fs = require('fs');
const path = require('path');
const TAG = path.basename(__filename);
const _ = require('lodash');

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


function setClearTokenInterval(objectstorage) {
	setInterval(() => {
		if (objectstorage.token) {
			objectstorage.logger.debug(`${TAG}: Invalidating auth token.`);
			objectstorage.token = undefined;
		}
	}, 1000 * 60 * 5); // invalidate token every 5 minutes
}


function ObjectStore(options) {
	this.robot = options.robot;
	this.res = options.res;
	this.logger = this.robot.logger;
	this.initSuccess = false;

	this.missingEnv;
	if (!options.settings.os_auth_url || options.settings.os_auth_url.length === 0) {
		this.missingEnv = 'HUBOT_OBJECT_STORAGE_AUTH_URL';
	}
	else if (!options.settings.os_user_id || options.settings.os_user_id.length === 0) {
		this.missingEnv = 'HUBOT_OBJECT_STORAGE_USER_ID';
	}
	else if (!options.settings.os_password || options.settings.os_password.length === 0) {
		this.missingEnv = 'HUBOT_OBJECT_STORAGE_PASSWORD';
	}
	else if (!options.settings.os_project_id || options.settings.os_project_id.length === 0) {
		this.missingEnv = 'HUBOT_OBJECT_STORAGE_PROJECT_ID';
	}
	else if (!options.settings.os_bluemix_region || options.settings.os_bluemix_region.length === 0) {
		this.missingEnv = 'HUBOT_OBJECT_STORAGE_BLUEMIX_REGION';
	}

	if (!this.missingEnv) {
		this.initSuccess = true;
	}

	this.authUrl = options.settings.os_auth_url;
	this.projectId = options.settings.os_project_id;
	this.userId = options.settings.os_user_id;
	this.password = options.settings.os_password;
	this.region = options.settings.os_bluemix_region;

	setClearTokenInterval(this);

	return this;
}

ObjectStore.prototype.initializedSuccessfully = function() {
	return this.initSuccess;
};

ObjectStore.prototype.getMissingEnv = function() {
	return this.missingEnv;
};

ObjectStore.prototype.checkAuth = function() {
	let os = this;
	if (!os.initializedSuccessfully()) {
		return Promise.reject(i18n.__('objectstorage.missing.envs', this.missingEnv));
	}

	if (os.token) {
		return Promise.resolve();
	}
	else {
		return new Promise((resolve, reject) => {
			let d = {
				auth: {
					identity: {
						methods: [
							'password'
						],
						password: {
							user: {
								id: os.userId,
								password: os.password
							}
						}
					},
					scope: {
						project: {
							id: os.projectId
						}
					}
				}
			};

			let url = os.authUrl + '/v3/auth/tokens';
			os.logger.debug(`${TAG}: Requesting OAUTH token for objectstore.  POST: ${url}`);
			request.post({
				url: url,
				json: d
			}, (err, res) => {
				if (err) {
					os.logger.error(`${TAG}: ` + 'objectstore', 'checkAuth', err);
					return reject(err);
				}
				else {
					os.logger.debug(`${TAG}: Successfully obtained token`);

					let body = res.body;
					if (res.headers['x-subject-token'] && body.token && body.token.catalog) {
						os.token = res.headers['x-subject-token'];
						// find object-storage
						let cat = body.token.catalog;
						let publicUrl;
						for (let i = 0; i < cat.length; i++) {
							let c = cat[i];
							if (c.type === 'object-store' && c.endpoints) {
								for (let j = 0; j < c.endpoints.length; j++) {
									let e = c.endpoints[j];
									if ((e.region === os.region) && (e.interface === 'public')) {
										publicUrl = e.url;
										break;
									}
								}
								break;
							}
						}
						if (publicUrl) {
							os.osUrl = publicUrl;
						}
						else {
							os.logger.error(`${TAG}: Unable to get access token on public interface for region ${os.region}`);
							return reject(new Error(`Unable to get access token on public interface for region ${os.region}`));
						}
						resolve();
					}
					else {
						os.logger.error(`${TAG}: Unable to get access token on public interface for region ${os.region}`);
						return reject(new Error(`Unable to get access token on public interface for region ${os.region}`));
					}
				}
			});
		});
	}
};

ObjectStore.prototype.getContainers = function() {
	let os = this;
	if (!os.initializedSuccessfully()) {
		return Promise.reject(i18n.__('objectstorage.missing.envs', this.missingEnv));
	}

	return this.checkAuth().then(() => {
		let url = os.osUrl;
		os.logger.debug(`${TAG}: Request object storage containers.  GET: ${url}`);
		return new Promise(function(resolve, reject) {
			request.get({
				url: url,
				qs: {
					format: 'json'
				},
				headers: {
					'X-AUTH-TOKEN': os.token
				}
			}, function(err, res) {
				if (err) {
					os.logger.error(`${TAG}: Unable to list containers`, err);
					return reject(err);
				}
				else {
					try {
						if (_.isString(res.body)) {
							let result = JSON.parse(res.body);
							resolve(result);
						}
						else {
							// Error
							throw new Error(`Invalid response body from ${url}. Value was not a String`);
						}
					}
					catch (parseError) {
						os.logger.error(`${TAG}: Response body that could not be parsed: ` + res.body);
						os.logger.error(`${TAG}: Unable to list containers`, parseError);
						reject(parseError);
					}
				}
			});
		});

	});
};

ObjectStore.prototype.getContainerDetails = function(containerName) {
	let os = this;
	if (!os.initializedSuccessfully()) {
		return Promise.reject(i18n.__('objectstorage.missing.envs', this.missingEnv));
	}

	return this.checkAuth().then(() => {
		let url = os.osUrl + '/' + containerName;
		os.logger.debug(`${TAG}: Request object storage container ${containerName} contents.  GET: ${url}`);
		return new Promise(function(resolve, reject) {
			request.get({
				url: url,
				qs: {
					format: 'json'
				},
				headers: {
					'X-AUTH-TOKEN': os.token
				}
			}, function(err, res) {
				if (err) {
					os.logger.error(`${TAG}: Unable to list container ${containerName} contents`, err);
					return reject(err);
				}
				else {
					try {
						if (_.isString(res.body)) {
							if (res.statusCode === 200) {
								let result = JSON.parse(res.body);
								resolve({
									name: containerName,
									objects: result
								});
							}
							else {
								throw new Error(`Container ${containerName} was not found.`);
							}
						}
						else {
							// Error
							throw new Error(`Invalid response body from ${url}. Value was not a String`);
						}
					}
					catch (responseError) {
						os.logger.error(`${TAG}: Unable to list container ${containerName} contents`, responseError);
						reject(responseError);
					}
				}
			});
		});
	});
};

ObjectStore.prototype.getObject = function(containerName, objectName) {
	let os = this;
	if (!os.initializedSuccessfully()) {
		return Promise.reject(i18n.__('objectstorage.missing.envs', this.missingEnv));
	}

	return this.checkAuth().then(() => {
		let url = os.osUrl + '/' + containerName + '/' + objectName;
		let dir = './downloads/';
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir);
		}
		let path = dir + objectName;

		os.logger.debug(`${TAG}: Request object storage object ${objectName} in container ${containerName}.  GET: ${url}`);
		return new Promise(function(resolve, reject) {
			request.get({
				url: url,
				qs: {
					format: 'json'
				},
				headers: {
					'X-AUTH-TOKEN': os.token
				}
			}).on('error', (err) => {
				os.logger.error(`${TAG}: Object ${objectName} was not found in container ${containerName}.`, err);
				reject(new Error(`Object ${objectName} was not found in container ${containerName}.`));
			}).on('complete', function(res) {
				if (res.statusCode === 200) {
					resolve({
						name: objectName,
						path: path
					});
				}
				else {
					reject(new Error(`Object ${objectName} could not be downloaded from container ${containerName}.`));
				}
			}).pipe(fs.createWriteStream(path, {
				autoClose: true
			}));
		});
	});
};

exports = module.exports = ObjectStore;
