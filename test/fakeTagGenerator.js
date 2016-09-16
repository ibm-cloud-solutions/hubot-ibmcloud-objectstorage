
/*
 * Licensed Materials - Property of IBM
 * (C) Copyright IBM Corp. 2016. All Rights Reserved.
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */
'use strict';

// Used to return tags without relying on the real tag generator code.
function FakeTagGenerator() {
}

FakeTagGenerator.prototype.initializedSuccessfully = function() {
	return true;
};

FakeTagGenerator.prototype.getMissingEnv = function() {
	return null;
};

FakeTagGenerator.prototype.isFileTypeSupported = function(objectInfo) {
	return true;
};

FakeTagGenerator.prototype.generateTags = function(objectInfo) {
	return Promise.resolve({
		objectInfo: objectInfo,
		tags: [
			'tag 1',
			'tag 2',
			'tag 3',
			'tag 4',
			'tag 5'
		]
	});
};

exports = module.exports = FakeTagGenerator;
