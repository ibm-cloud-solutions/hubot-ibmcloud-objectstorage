[![Build Status](https://travis-ci.org/ibm-cloud-solutions/hubot-ibmcloud-objectstorage.svg?branch=master)](https://travis-ci.org/ibm-cloud-solutions/hubot-ibmcloud-objectstorage)
[![Coverage Status](https://coveralls.io/repos/github/ibm-cloud-solutions/hubot-ibmcloud-objectstorage/badge.svg?branch=master)](https://coveralls.io/github/ibm-cloud-solutions/hubot-ibmcloud-objectstorage?branch=master)
[![Dependency Status](https://dependencyci.com/github/ibm-cloud-solutions/hubot-ibmcloud-objectstorage/badge)](https://dependencyci.com/github/ibm-cloud-solutions/hubot-ibmcloud-objectstorage)
[![npm](https://img.shields.io/npm/v/hubot-ibmcloud-objectstorage.svg?maxAge=2592000)](https://www.npmjs.com/package/hubot-ibmcloud-objectstorage)

# hubot-ibmcloud-objectstorage

A Hubot script for managing Object Storage containers messages with [IBM Object Storage](https://console.ng.bluemix.net/catalog/services/object-storage/).

## Getting Started
* [Usage](#usage)
* [Commands](#commands)
* [Hubot Adapter Setup](#hubot-adapter-setup)
* [Development](#development)
* [License](#license)
* [Contribute](#contribute)

## Usage

Steps for adding this to your existing hubot:

1. `cd` into your hubot directory
2. Install the Swift Object Storage functionality with `npm install hubot-ibmcloud-objectstorage --save`
3. Add `hubot-ibmcloud-translate` to your `external-scripts.json`
4. Add the necessary environment variables:
```
export HUBOT_OBJECT_STORAGE_AUTH_URL=<URL>
export HUBOT_OBJECT_STORAGE_USER_ID=<USER_ID>
export HUBOT_OBJECT_STORAGE_PASSWORD=<PASSWORD>
export HUBOT_OBJECT_STORAGE_PROJECT_ID=<PROJECT_ID>
export HUBOT_OBJECT_STORAGE_BLUEMIX_REGION=dallas
```

5. Start up your bot & off to the races!

## Commands
- `hubot objectstorage help` - Show available commands in the ibmcloud objectstorage category.
- `hubot objectstorage container list` - Show all Object Storage containers

## Hubot Adapter Setup

Hubot supports a variety of adapters to connect to popular chat clients.  For more feature rich experiences you can setup the following adapters:
- [Slack setup](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-objectstorage/blob/master/docs/adapters/slack.md)
- [Facebook Messenger setup](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-objectstorage/blob/master/docs/adapters/facebook.md)

## Development

Please refer to the [CONTRIBUTING.md](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-objectstorage/blob/master/CONTRIBUTING.md) before starting any work.  Steps for running this script for development purposes:

### Configuration Setup

1. Create `config` folder in root of this project.
2. Create `env` in the `config` folder, with the following contents:
```
export HUBOT_OBJECT_STORAGE_AUTH_URL=<URL>
export HUBOT_OBJECT_STORAGE_USER_ID=<USER_ID>
export HUBOT_OBJECT_STORAGE_PASSWORD=<PASSWORD>
export HUBOT_OBJECT_STORAGE_PROJECT_ID=<PROJECT_ID>
export HUBOT_OBJECT_STORAGE_BLUEMIX_REGION=dallas
```
3. In order to view content in chat clients you will need to add `hubot-ibmcloud-formatter` to your `external-scripts.json` file. Additionally, if you want to use `hubot-help` to make sure your command documentation is correct. Create `external-scripts.json` in the root of this project, with the following contents:
```
[
    "hubot-help",
    "hubot-ibmcloud-formatter"
]
```
4. Lastly, run `npm install` to obtain all the dependent node modules.

### Running Hubot with adapters

Hubot supports a variety of adapters to connect to popular chat clients.

If you just want to use:
 - Terminal: run `npm run start`
 - [Slack: link to setup instructions](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-objectstorage/blob/master/docs/adapters/slack.md)
 - [Facebook Messenger: link to setup instructions](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-objectstorage/blob/master/docs/adapters/facebook.md)

## License

See [LICENSE.txt](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-objectstorage/blob/master/LICENSE.txt) for license information.

## Contribute

Please check out our [Contribution Guidelines](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-objectstorage/blob/master/CONTRIBUTING.md) for detailed information on how you can lend a hand.
