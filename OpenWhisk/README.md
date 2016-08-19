# OpenWhisk actions for NLC Training

A set of OpenWhisk actions to integrate hubot-ibmcloud-objectstorage with the sample [BluePic app](https://github.com/IBM-Swift/BluePic).

## Usage

Steps to use the OpenWhisk action.  This assumes you've already setup the BluePic sample app.

1. `cd` into the `hubot-ibmcloud-objectstorage/OpenWhisk` directory.
2. Create a file named `env` exporting these required Bluemix service credentials:

```
export cloudantUsername=<<Username for BluePic Cloudant>>
export cloudantPassword=<<Password for BluePic Cloudant>>
export cloudantDbName=<<Name of BluePic Cloudant database>>
export cloudantHost=<<Host of BluePic Cloudant>>

export nlcUsername=<<Username of NLC service for hubot-ibmcloud-objectstorage>>
export nlcPassword=<<Password of NLC service for hubot-ibmcloud-objectstorage>>
export nlcUrl=<<Url of NLC service>>
```

3. Run the OpenWhisk setup script `./deploy.sh` to see command usage.  Then `./deploy.sh --install` to create the related OpenWhisk artifacts.
4. Use the BluePic app to upload new images.  This should trigger training of the NLC instance used for hubot-ibmcloud-objectstorage.

## Running locally

You can run the OpenWhisk action as a local node.js application using these steps:

1. Modify the `hubot-ibmcloud-objectstorage/OpenWhisk/env` file to include the following export:

```
export localRun=true
```

2. cd `hubot-ibmcloud-objectstorage` and issue the run command: `npm run whisk`.