# Botium Connector for Azure Custom Question Answering

[![NPM](https://nodei.co/npm/botium-connector-azure-cqa.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/botium-connector-azure-cqa/)

[![Codeship Status for codeforequity-at/botium-connector-azure-cqa](https://app.codeship.com/projects/2aef0d9b-bcf3-4d91-a05f-a18502f96104/status?branch=main)](https://app.codeship.com/projects/462873)
[![npm version](https://badge.fury.io/js/botium-connector-azure-cqa.svg)](https://badge.fury.io/js/botium-connector-azure-cqa)
[![license](https://img.shields.io/github/license/mashape/apistatus.svg)]()

This is a [Botium](https://github.com/codeforequity-at/botium-core) connector for testing your Azure Custom Question Answering intent resolution logic.

__Did you read the [Botium in a Nutshell](https://medium.com/@floriantreml/botium-in-a-nutshell-part-1-overview-f8d0ceaf8fb4) articles? Be warned, without prior knowledge of Botium you won't be able to properly use this library!__

## How it works

It can be used as any other Botium connector with all Botium Stack components:
* [Botium CLI](https://github.com/codeforequity-at/botium-cli/)
* [Botium Bindings](https://github.com/codeforequity-at/botium-bindings/)
* [Botium Box](https://www.botium.at)

## Prerequisites

* __Node.js and NPM__
* [AZURE subsription](https://azure.microsoft.com/free/cognitive-services)
* Azure CQA project
* [Resource key, and endpoint of the Azure CQA project](https://learn.microsoft.com/en-us/azure/cognitive-services/language-service/conversational-language-understanding/quickstart#get-your-resource-keys-and-endpoint)
* The name of the Azure CQA project
* The deployment name
* A __project directory__ on your workstation to hold test cases and Botium configuration

See also [Create, test, and deploy a custom question answering project](https://learn.microsoft.com/en-us/azure/cognitive-services/language-service/question-answering/how-to/create-test-deploy)

## Install Botium and Azure Custom Question Answering Connector

When using __Botium CLI__:

```
> npm install -g botium-cli
> npm install -g botium-connector-azure-cqa
> botium-cli init
> botium-cli run
```

When using __Botium Bindings__:

```
> npm install -g botium-bindings
> npm install -g botium-connector-azure-cqa
> botium-bindings init mocha
> npm install && npm run mocha
```

When using __Botium Box__:

_Already integrated into Botium Box, no setup required_

## Connecting Azure Custom Question Answering

Create a botium.json with Azure resource key, and endpoint:

```javascript
{
  "botium": {
    "Capabilities": {
      "PROJECTNAME": "Botium Project Azure CQA",
      "CONTAINERMODE": "azure-cqa",
      "AZURE_CQA_ENDPOINT_URL": "xxx",
      "AZURE_CQA_ENDPOINT_KEY": "xxx",
      "AZURE_CQA_PROJECT_NAME": "xxx"
    }
  }
}
```

Botium setup is ready, you can begin to write your [BotiumScript](https://github.com/codeforequity-at/botium-core/wiki/Botium-Scripting) files.

## Supported Capabilities

Set the capability __CONTAINERMODE__ to __azure-cqa__ to activate this connector.

### AZURE_CQA_ENDPOINT_URL
See [Resource key, and endpoint of the Azure CQA project](https://learn.microsoft.com/en-us/azure/cognitive-services/language-service/conversational-language-understanding/quickstart#get-your-resource-keys-and-endpoint)

### AZURE_CQA_ENDPOINT_KEY
See [Resource key, and endpoint of the Azure CQA project](https://learn.microsoft.com/en-us/azure/cognitive-services/language-service/conversational-language-understanding/quickstart#get-your-resource-keys-and-endpoint)

### AZURE_CQA_PROJECT_NAME
The name of the Azure CQA project

### AZURE_CQA_USER_ID
The user ID.
_Default: random (uuid)_

### AZURE_CQA_DEPLOYMENT_NAME
The name of the specific deployment of the project to use.
_Default: 'production'_

### AZURE_CQA_API_VERSION
API version.
_Default: 2021-10-01_

### AZURE_CQA_RANKER_TYPE
Type of ranker to be used.
_Default: 'Default'_
Possible values:
* Default
* QuestionOnly

### AZURE_CQA_INCLUDE_UNSTRUCTURED_SOURCES
Flag to enable Query over Unstructured Sources.
_Default: true_

### AZURE_CQA_API_VERSION
Enable or disable Answer Span prediction. See also [Precise answering](https://learn.microsoft.com/en-us/azure/cognitive-services/language-service/question-answering/concepts/precise-answering)
_Default: false_


See also [Question Answering - Get Answers](https://learn.microsoft.com/en-us/rest/api/cognitiveservices/questionanswering/question-answering/get-answers)





