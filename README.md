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

## Usage <a id="usage"></a>

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

## Commands <a id="commands"></a>
- `hubot objectstorage help` - Show available commands in the ibmcloud objectstorage category.
- `hubot objectstorage container list` - Show all Object Storage containers

## Hubot Adapter Setup <a id="hubot-adapter-setup"></a>

Hubot supports a variety of adapters to connect to popular chat clients.  For more feature rich experiences you can setup the following adapters:
- [Slack setup](./docs/adapters/slack.md)
- [Facebook Messenger setup](./docs/adapters/facebook.md)

## Development <a id="development"></a>

Please refer to the [CONTRIBUTING.md](./CONTRIBUTING.md) before starting any work.  Steps for running this script for development purposes:

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
 - [Slack: link to setup instructions](docs/adapters/slack.md)
 - [Facebook Messenger: link to setup instructions](docs/adapters/facebook.md)

## License <a id="license"></a>

See [LICENSE.txt](./LICENSE.txt) for license information.

## Contribute <a id="contribute"></a>

Please check out our [Contribution Guidelines](./CONTRIBUTING.md) for detailed information on how you can lend a hand.
