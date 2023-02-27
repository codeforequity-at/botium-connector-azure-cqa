const debug = require('debug')('botium-connector-azure-cqa')
const { v4: uuidv4 } = require('uuid')
const axios = require('axios')

const DEFAULT_API_VERSION = '2021-10-01'
const DEFAULT_DEPLOYMENT_NAME = 'production'

const Capabilities = {
  AZURE_CQA_ENDPOINT_URL: 'AZURE_CQA_ENDPOINT_URL',
  AZURE_CQA_ENDPOINT_KEY: 'AZURE_CQA_ENDPOINT_KEY',
  AZURE_CQA_PROJECT_NAME: 'AZURE_CQA_PROJECT_NAME',
  AZURE_CQA_USER_ID: 'AZURE_CQA_USER_ID',
  // experimental, not tested, optional caps
  AZURE_CQA_DEPLOYMENT_NAME: 'AZURE_CQA_DEPLOYMENT_NAME',
  AZURE_CQA_API_VERSION: 'AZURE_CQA_API_VERSION',
  AZURE_CQA_RANKER_TYPE: 'AZURE_CQA_RANKER_TYPE', // Default or QuestionOnly
  AZURE_CQA_INCLUDE_UNSTRUCTURED_SOURCES: 'AZURE_CQA_INCLUDE_UNSTRUCTURED_SOURCES',
  AZURE_CQA_ANSWER_SPAN: 'AZURE_CQA_ANSWER_SPAN'
}

class BotiumConnectorAzureCQA {
  constructor ({ queueBotSays, caps }) {
    this.queueBotSays = queueBotSays
    this.caps = caps
    this.userId = null
  }

  async Validate () {
    debug('Validate called')
    if (!this.caps[Capabilities.AZURE_CQA_ENDPOINT_URL]) throw new Error('AZURE_CQA_ENDPOINT_URL capability required')
    if (!this.caps[Capabilities.AZURE_CQA_ENDPOINT_KEY]) throw new Error('AZURE_CQA_ENDPOINT_KEY capability required')
    if (!this.caps[Capabilities.AZURE_CQA_PROJECT_NAME]) throw new Error('AZURE_CQA_PROJECT_NAME capability required')
  }

  Build () {
  }

  Start () {
    debug('Start called')
    this.userId = this.caps[Capabilities.AZURE_CQA_USER_ID] || `${uuidv4()}`
    this.context = null
  }

  async UserSays ({ messageText }) {
    const requestOptions = {
      url: `${this.caps.AZURE_CQA_ENDPOINT_URL}/language/:query-knowledgebases?projectName=${this.caps.AZURE_CQA_PROJECT_NAME}&api-version=${this.caps.AZURE_CQA_API_VERSION || DEFAULT_API_VERSION}&deploymentName=${this.caps.AZURE_CQA_DEPLOYMENT_NAME || DEFAULT_DEPLOYMENT_NAME}`,
      headers: {
        'Ocp-Apim-Subscription-Key': this.caps.AZURE_CQA_ENDPOINT_KEY
      },
      method: 'POST',
      data: {
        question: messageText,
        userId: this.userId,
        includeUnstructuredSources: this.caps.AZURE_CQA_INCLUDE_UNSTRUCTURED_SOURCES || true,
        answerSpanRequest: {
          enable: this.caps.AZURE_CQA_ANSWER_SPAN || false
        },
        context: this.context,
        rankerType: this.caps.AZURE_CQA_RANKER_TYPE || 'Default'
      }
    }
    debug(`Request: ${JSON.stringify(requestOptions, null, 2)}`)

    const { data } = await axios(requestOptions)

    debug(`Response: ${JSON.stringify(data, null, 2)}`)

    let structuredResponse
    if (data.answers && data.answers.length) {
      const intents = data.answers.map(a => ({
        name: (a.questions && a.questions.length) ? a.questions[0] : 'N/A',
        confidence: a.confidenceScore
      }))
      structuredResponse = {
        sender: 'bot',
        messageText: data.answers[0].answer,
        nlp: {
          intent: Object.assign({}, intents[0], { intents: intents.slice(1) })
        },
        sourceData: {
          request: requestOptions,
          response: data
        }
      }
      if (data.answers[0].dialog?.prompts?.length) {
        structuredResponse.buttons = data.answers[0].dialog.prompts.map(({ displayText, qnaId }) => ({ text: displayText, payload: qnaId }))
      }
      this.context = {
        previousQnaId: data.answers[0].id,
        previousUserQuery: messageText
      }
    } else {
      structuredResponse = {
        name: 'None',
        incomprehension: true,
        confidence: 1
      }
      this.context = null
    }

    debug(`Structured response: ${JSON.stringify(structuredResponse, null, 2)}`)
    setTimeout(() => this.queueBotSays(structuredResponse), 0)
  }

  Stop () {
    debug('Stop called')
    this.userId = null
    this.context = null
  }
}

BotiumConnectorAzureCQA.DEFAULT_API_VERSION = DEFAULT_API_VERSION

module.exports = BotiumConnectorAzureCQA
