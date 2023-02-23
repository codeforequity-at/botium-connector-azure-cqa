const debug = require('debug')('botium-connector-azure-cqa-intents')
const axios = require('axios')
const DEFAULT_API_VERSION = require('./connector').DEFAULT_API_VERSION
const AdmZip = require('adm-zip')

const QNA_FILE_NAME = 'QnAs.tsv'

const axiosCustomError = async (options, msg) => {
  try {
    return axios(options)
  } catch (err) {
    throw new Error(`${msg}: ${err.message}`)
  }
}

const _importIt = async ({ caps }) => {
  const requestOptionsImport = {
    url: `${caps.AZURE_CQA_ENDPOINT_URL}/language/query-knowledgebases/projects/${caps.AZURE_CQA_PROJECT_NAME}/:export?api-version=${caps.AZURE_CQA_API_VERSION || DEFAULT_API_VERSION}&format=json`,
    headers: {
      'Ocp-Apim-Subscription-Key': caps.AZURE_CQA_ENDPOINT_KEY
    },
    method: 'post'
  }
  debug(`import request: ${JSON.stringify(requestOptionsImport, null, 2)}`)
  const responseImport = await axiosCustomError(requestOptionsImport, 'Import failed')
  const operationLocation = (responseImport && responseImport.headers && responseImport.headers['operation-location']) ? responseImport.headers['operation-location'] : null
  if (!operationLocation) {
    throw new Error(`Operation Location not found in ${JSON.stringify(responseImport.headers)}`)
  }

  debug(`import status request: ${JSON.stringify(requestOptionsImport, null, 2)}`)
  const requestOptionsImportStatus = {
    url: operationLocation,
    headers: {
      'Ocp-Apim-Subscription-Key': caps.AZURE_CQA_ENDPOINT_KEY
    },
    method: 'get'
  }
  let resultUrl = null
  let responseImportStatus
  for (let tries = 0; tries < 30 && !resultUrl; tries++) {
    responseImportStatus = await axiosCustomError(requestOptionsImportStatus, 'Import status failed')
    if (responseImportStatus.data.errors?.length > 0) {
      throw new Error(`Import failed: ${JSON.stringify(responseImportStatus.errors)}`)
    }

    if (['cancelled', 'cancelling', 'failed'].includes(responseImportStatus.data.status)) {
      throw new Error(`Import failed, job status is: ${responseImportStatus.data.status}`)
    }

    resultUrl = responseImportStatus.data.resultUrl
    if (!resultUrl) {
      debug(`Try ${tries + 1} Result URI is not ready yet. Waiting 1s.`)
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  if (!resultUrl) {
    throw new Error(`Failed to retrieve the result URL: ${JSON.stringify(responseImportStatus.data)}`)
  }
  const requestOptionsDownload = {
    method: 'get',
    url: resultUrl,
    // responseType: 'arraybuffer',
    headers: {
      'Ocp-Apim-Subscription-Key': caps.AZURE_CQA_ENDPOINT_KEY
    }
  }

  const responseDownload = await axiosCustomError(requestOptionsDownload, 'Download failed')
  const zip = new AdmZip(responseDownload.data)
  const qnas = zip.getEntry(QNA_FILE_NAME)?.getData().toString('utf8').trim()
  if (!qnas) {
    throw new Error('Not supported zip format')
  }

  let start = qnas.indexOf('\n')
  const answerToChatbotStruct = {}
  const intentToChatbotStruct = {}
  while (start >= 0) {
    const end = qnas.indexOf('\n', start + 1)
    const [question, answer, source, metadata, suggestedQuestions, isContextOnly, prompts, qnaId] = qnas.substring(start, end > 0 ? end : qnas.length).trim().split('\t')
    start = end
    if (!answerToChatbotStruct[answer]) {
      const struct = {
        answer,
        source,
        metadata,
        suggestedQuestions,
        isContextOnly,
        prompts,
        qnaId,
        questions: []
      }
      answerToChatbotStruct[answer] = struct
      // first question is the intent
      intentToChatbotStruct[question] = struct
    }

    answerToChatbotStruct[answer].questions.push(question)
  }

  const answers = Object.keys(intentToChatbotStruct).length
  const questions = Object.values(intentToChatbotStruct).reduce((sum, { questions }) => {
    sum += questions.length
    return sum
  }, 0)
  debug(`import succesful, #answers: ${answers}, #questions: ${questions} details: ${Object.values(intentToChatbotStruct).map(({ answer, questions }) => '/"' + answer + '/" (' + questions.length + ')').join(', ')}`)

  return { answerToChatbotStruct, intentToChatbotStruct, zip }
}

/**
 *
 * @param caps
 * @param dataset - "Train" for training data, or null for all
 * @param language - in "en-us" format, or null for all
 * @returns {Promise<{utterances: *, convos: *}>}
 */
const importAzureCQAIntents = async ({ caps }) => {
  try {
    const { answerToChatbotStruct } = await _importIt({ caps })
    const utterances = Object.values(answerToChatbotStruct).map(({ questions }) => ({
      name: questions[0],
      utterances: questions
    }))
    // first question is the intent
    const convos = Object.values(answerToChatbotStruct).map(({ answer, questions }) => ({
      header: {
        name: questions[0]
      },
      conversation: [
        {
          sender: 'me',
          messageText: questions[0]
        },
        {
          sender: 'bot',
          messageText: answer,
          asserters: [
            {
              name: 'INTENT',
              args: [questions[0]]
            }
          ]
        }
      ]
    }))

    return {
      convos,
      utterances
    }
  } catch (err) {
    throw new Error(`Import failed: ${err.message}`)
  }
}

const exportAzureCQAIntents = async ({ caps, uploadmode }, { convos, utterances }, { statusCallback }) => {
  try {
    const { intentToChatbotStruct, zip } = await _importIt({
      caps
    })
    const intentToBotiumStruct = {}
    for (const { name, utterances: list } of utterances) {
      if (list.length > 0) {
        intentToBotiumStruct[name] = { utterances: list, answer: null }
      }
    }

    for (const { header, conversation } of convos || []) {
      if (conversation?.[0].sender !== 'me' || !intentToBotiumStruct[conversation?.[0].messageText]) {
        debug(`Incompatible convo skipped. (Incorrect #me section): ${header?.name || JSON.stringify(conversation)}`)
        continue
      }
      if (conversation?.[1].sender !== 'bot' || !conversation?.[1].messageText) {
        debug(`Incompatible convo skipped. (Incorrect #bot section): ${header?.name || JSON.stringify(conversation)}`)
        continue
      }
      intentToBotiumStruct[conversation[0].messageText].answer = conversation[1].messageText
    }

    for (const [intent, struct] of Object.entries(intentToChatbotStruct)) {
      if (uploadmode === 'replace') {
        if (!intentToBotiumStruct[intent]) {
          intentToChatbotStruct[intent] = null
          continue
        } else {
          struct.questions = intentToBotiumStruct[intent].utterances
        }
      } else {
        for (const utterance of intentToBotiumStruct[intent]?.utterances || []) {
          if (!struct.questions.find(q => q === utterance)) {
            struct.questions.push(utterance)
          }
        }
      }
      if (intentToBotiumStruct[intent]) {
        intentToChatbotStruct[intent].answer = intentToBotiumStruct[intent].answer
      }
    }

    for (const [intent, { answer, utterances }] of Object.entries(intentToBotiumStruct)) {
      if (!intentToChatbotStruct[intent]) {
        if (answer) {
          intentToChatbotStruct[intent] = {
            answer,
            questions: utterances
          }
        } else {
          debug(`Skipping utterance struct for intent ${intent} because there is no answer defined`)
        }
      }
    }

    const answers = Object.keys(intentToChatbotStruct).length
    const questions = Object.values(intentToChatbotStruct).reduce((sum, { questions }) => {
      sum += questions.length
      return sum
    }, 0)
    debug(`ready to export #answers: ${answers}, #questions: ${questions} details: ${Object.values(intentToChatbotStruct).map(({ answer, questions }) => '/"' + answer + '/" (' + questions.length + ')').join(', ')}`)

    let qnas = 'Question\tAnswer\tSource\tMetadata\tSuggestedQuestions\tIsContextOnly\tPrompts\tQnaId\n'
    for (const { answer, questions, source = '', metadata = '', suggestedQuestions = '', isContextOnly = '', prompts = '', qnaId = '' } of Object.values(intentToChatbotStruct)) {
      if (!answer || !questions?.length) {
        debug(`Skipping invalid entry ${JSON.stringify({ answer, questions })}`)
      } else {
        for (const question of questions) {
          qnas += `${question}\t${answer}\t${source}\t${metadata}\t${suggestedQuestions}\t${isContextOnly}\t${prompts}\t${qnaId}`
        }
      }
    }
    zip.addFile(QNA_FILE_NAME, Buffer.from(qnas, 'utf8'))

    const requestOptionsExport = {
      url: `${caps.AZURE_CQA_ENDPOINT_URL}/language/query-knowledgebases/projects/${caps.AZURE_CQA_PROJECT_NAME}/:import?api-version=${caps.AZURE_CQA_API_VERSION || DEFAULT_API_VERSION}&format=tsv`,
      headers: {
        'Ocp-Apim-Subscription-Key': caps.AZURE_CQA_ENDPOINT_KEY
      },
      method: 'POST',
      data: zip
    }
    const responseExport = await axiosCustomError(requestOptionsExport, 'Export failed')
    debug(`Export started. Operation location: "${responseExport.headers['operation-location']}" response: ${JSON.stringify(responseExport.data, null, 2)}`)
    const operationLocation = responseExport.headers['operation-location']
    if (!operationLocation) {
      throw new Error(`Operation Location not found in ${JSON.stringify(responseExport.headers)}`)
    }

    debug(`export status request: ${JSON.stringify(requestOptionsExport, null, 2)}`)
    const requestOptionsExportStatus = {
      url: operationLocation,
      headers: {
        'Ocp-Apim-Subscription-Key': caps.AZURE_CQA_ENDPOINT_KEY
      },
      method: 'GET'
    }
    let responseExportStatus
    for (let tries = 0; tries < 10 && (!responseExportStatus || ['notStarted', 'partiallyCompleted', 'running'].includes(responseExportStatus.data.status)); tries++) {
      responseExportStatus = await axiosCustomError(requestOptionsExportStatus, 'Export status failed')
      if (responseExportStatus.data.errors?.length > 0) {
        throw new Error(`Export failed with errors: ${JSON.stringify(responseExportStatus.data.errors)}`)
      }

      if (['cancelled', 'cancelling', 'failed'].includes(responseExportStatus.data.status)) {
        throw new Error(`Export failed, job status is: ${responseExportStatus.data.status}`)
      }
    }
    debug(`Last export status: ${JSON.stringify(responseExportStatus.data, null, 2)}`)
  } catch (err) {
    // TODO
    throw err//new Error(`Export process failed: ${err.message}`)
  }

  debug('export finished')
}

module.exports = {
  importHandler: ({ caps, dataset, language, ...rest } = {}) => importAzureCQAIntents({
    caps,
    dataset,
    language,
    ...rest
  }),
  importArgs: {
    caps: {
      describe: 'Capabilities',
      type: 'json',
      skipCli: true
    }
  },
  exportHandler: ({ caps, uploadmode, dataset, language, ...rest } = {}, { convos, utterances } = {}, { statusCallback } = {}) => exportAzureCQAIntents({
    caps,
    uploadmode,
    dataset,
    language,
    ...rest
  }, {
    convos,
    utterances
  }, { statusCallback }),
  exportArgs: {
    caps: {
      describe: 'Capabilities',
      type: 'json',
      skipCli: true
    },
    uploadmode: {
      describe: 'Appending Azure CQA intents and user examples or replace them',
      choices: ['append', 'replace'],
      default: 'append'
    },
    dataset: {
      describe: 'Type of the dataset (Train, or Test)',
      choices: ['Train', 'Test']
    },
    language: {
      describe: 'Language (like en-us)',
      type: 'string'
    }
  }
}
