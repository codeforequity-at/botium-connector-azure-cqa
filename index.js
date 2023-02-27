const BotiumConnectorAzureCQA = require('./src/connector')
const { importHandler, importArgs } = require('./src/intents')
const { exportHandler, exportArgs } = require('./src/intents')
const fs = require('fs')
const path = require('path')

const logo = fs.readFileSync(path.join(__dirname, 'logo.png')).toString('base64')

module.exports = {
  PluginVersion: 1,
  PluginClass: BotiumConnectorAzureCQA,
  Import: {
    Handler: importHandler,
    Args: importArgs
  },
  Export: {
    Handler: exportHandler,
    Args: exportArgs
  },
  PluginDesc: {
    name: 'Azure Conversational Language Understanding',
    avatar: logo,
    provider: 'Microsoft',
    features: {
      intentResolution: true,
      intentConfidenceScore: true,
      alternateIntents: true,
      entityResolution: true,
      entityConfidenceScore: false,
      testCaseGeneration: true,
      testCaseExport: true
    },
    capabilities: [
      {
        name: 'AZURE_CQA_ENDPOINT_URL',
        label: 'Endpoint URL',
        description: 'Azure CQA endpoint URL',
        type: 'url',
        required: true
      },
      {
        name: 'AZURE_CQA_ENDPOINT_KEY',
        label: 'Endpoint Key',
        description: 'Azure CQA Subscription Key',
        type: 'secret',
        required: true
      },
      {
        name: 'AZURE_CQA_PROJECT_NAME',
        label: 'Project Name',
        description: 'Azure CQA Project Name',
        type: 'string',
        required: true
      },
      {
        name: 'AZURE_CQA_USER_ID',
        label: 'User ID',
        description: 'User ID (Keep it empty to use random)',
        type: 'string',
        advanced: true,
        required: false
      },
      {
        name: 'AZURE_CQA_DEPLOYMENT_NAME',
        label: 'Deployment Name',
        description: 'Azure CQA Deployment Name',
        type: 'string',
        advanced: true,
        required: false
      },
      {
        name: 'AZURE_CQA_PARTICIPANT_ID',
        label: 'Direct Target',
        description: 'Azure CQA Participant ID (Keep it empty to use random)',
        type: 'string',
        advanced: true,
        required: false
      },
      {
        name: 'AZURE_CQA_API_VERSION',
        label: 'API Version',
        description: 'Azure CQA API Version',
        type: 'string',
        required: false,
        advanced: true
      },
      {
        name: 'AZURE_CQA_RANKER_TYPE',
        label: 'Ranker Type',
        description: 'Azure CQA Ranker Type',
        type: 'choice',
        required: false,
        advanced: true,
        choices: [
          { key: 'Default', name: 'Default' },
          { key: 'QuestionOnly', name: 'QuestionOnly' }
        ]
      },
      {
        name: 'AZURE_CQA_INCLUDE_UNSTRUCTURED_SOURCES',
        label: 'Include Unstructured Sources',
        type: 'string',
        required: false,
        advanced: true
      },
      {
        name: 'AZURE_CQA_ANSWER_SPAN',
        description: 'Enable Answer Span',
        type: 'string',
        required: false,
        advanced: true
      }
    ]
  }
}
