const debug = require('debug')('botium-connector-azure-cqa-intents')
const axios = require('axios')
const DEFAULT_API_VERSION = require('./connector').DEFAULT_API_VERSION

const axiosCustomError = async (options, msg) => {
  try {
    return axios(options)
  } catch (err) {
    throw new Error(`${msg}: ${err.message}`)
  }
}

const _importIt = async ({ caps, statusCallback = debug }) => {
  statusCallback('Download started')
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
  for (let tries = 0; tries < 10 * 60 && !resultUrl; tries++) {
    responseImportStatus = await axiosCustomError(requestOptionsImportStatus, 'Import status failed')
    if (responseImportStatus.data.errors?.length > 0) {
      throw new Error(`Import failed: ${JSON.stringify(responseImportStatus.errors)}`)
    }

    if (['cancelled', 'cancelling', 'failed'].includes(responseImportStatus.data.status)) {
      throw new Error(`Import failed, job status is: ${responseImportStatus.data.status}`)
    }

    resultUrl = responseImportStatus.data.resultUrl
    if (!resultUrl) {
      statusCallback(`Try #${tries + 1} done. Download is not finished yet. Waiting 1s.`)
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  if (!resultUrl) {
    throw new Error(`Failed to retrieve the result URL: ${JSON.stringify(responseImportStatus.data)}`)
  }
  const requestOptionsDownload = {
    method: 'get',
    url: resultUrl,
    headers: {
      'Ocp-Apim-Subscription-Key': caps.AZURE_CQA_ENDPOINT_KEY
    }
  }

  const responseDownload = await axiosCustomError(requestOptionsDownload, 'Download failed')

  const answers = responseDownload.data.Assets.Qnas.length
  const questions = responseDownload.data.Assets.Qnas.reduce((sum, { Questions }) => {
    sum += Questions.length
    return sum
  }, 0)
  const mapped = responseDownload.data.Assets.Qnas.map(({ Answer, Questions }) => ({ [Answer]: Questions.length }))
  debug(`Imported #answers: ${answers}, #questions: ${questions} details: ${JSON.stringify(mapped)}`)

  return responseDownload.data
}

/**
 *
 * @param caps
 * @returns {Promise<{utterances: *, convos: *}>}
 */
const importAzureCQAIntents = async ({ caps }) => {
  try {
    const { Assets } = await _importIt({ caps })
    const utterances = Assets.Qnas.map(({ Questions }) => ({
      name: Questions[0],
      utterances: Questions
    }))
    // first question is the intent
    const convos = Assets.Qnas.map(({ Answer, Questions }) => ({
      header: {
        name: Questions[0]
      },
      conversation: [
        {
          sender: 'me',
          messageText: Questions[0]
        },
        {
          sender: 'bot',
          messageText: Answer,
          asserters: [
            {
              name: 'INTENT',
              args: [Questions[0]]
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

const exportAzureCQAIntents = async ({ caps, uploadmode }, { convos, utterances }, third) => {
  try {
    const statusCallback = (log, obj) => {
      obj ? debug(log, obj) : debug(log)
      if (third.statusCallback) third.statusCallback(log, obj)
    }
    statusCallback('Upload started')

    const chatbotData = await _importIt({
      caps,
      statusCallback
    })
    const intentToBotiumStruct = {}
    for (let { name, utterances: list } of utterances) {
      if (list.length > 0) {
        if (list[0] !== name) {
          list = [name, ...list]
        }
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

    // removing intents not existing anymore
    if (uploadmode === 'replace') {
      chatbotData.Assets.Qnas = chatbotData.Assets.Qnas.filter(({ Questions }) => intentToBotiumStruct[Questions[0]])
    }

    // merge/replace existing intents
    const usedIds = {}
    for (const struct of chatbotData.Assets.Qnas) {
      const intent = struct.Questions[0]
      usedIds[`${struct.Id}`] = true
      if (uploadmode === 'replace') {
        struct.Questions = intentToBotiumStruct[intent].utterances
      } else {
        for (const utterance of intentToBotiumStruct[intent]?.utterances || []) {
          if (!struct.Questions.find(q => q === utterance)) {
            struct.Questions.push(utterance)
          }
        }
      }
      if (intentToBotiumStruct[intent] && intentToBotiumStruct[intent].answer) {
        struct.Answer = intentToBotiumStruct[intent].answer
      }
    }

    // adding new intents
    let nextId = 1
    for (const [intent, { answer, utterances }] of Object.entries(intentToBotiumStruct)) {
      if (!chatbotData.Assets.Qnas.find(({ Questions }) => Questions[0] === intent)) {
        while (usedIds[`${nextId}`]) {
          nextId++
        }

        if (answer) {
          chatbotData.Assets.Qnas.push({
            Answer: answer,
            Questions: utterances,
            Id: nextId++
          })
        } else {
          debug(`Skipping utterance struct for intent ${intent} because there is no answer defined`)
        }
      }
    }

    const answers = chatbotData.Assets.Qnas.length
    const questions = chatbotData.Assets.Qnas.reduce((sum, { Questions }) => {
      sum += Questions.length
      return sum
    }, 0)
    const mapped = chatbotData.Assets.Qnas.map(({ Answer, Questions }) => ({ [Answer]: Questions.length }))
    debug(`Ready to export #answers: ${answers}, #questions: ${questions} details: ${JSON.stringify(mapped)}`)

    const requestOptionsExport = {
      url: `${caps.AZURE_CQA_ENDPOINT_URL}/language/query-knowledgebases/projects/${caps.AZURE_CQA_PROJECT_NAME}/:import?api-version=${caps.AZURE_CQA_API_VERSION || DEFAULT_API_VERSION}&format=json`,
      headers: {
        'Ocp-Apim-Subscription-Key': caps.AZURE_CQA_ENDPOINT_KEY
      },
      method: 'POST',
      data: chatbotData
    }
    const responseExport = await axiosCustomError(requestOptionsExport, 'Export failed')
    debug(`Export started. Operation location: "${responseExport.headers['operation-location']}" response: ${JSON.stringify(responseExport.data, null, 2)}`)
    const operationLocation = responseExport.headers['operation-location']
    if (!operationLocation) {
      throw new Error(`Operation Location not found in ${JSON.stringify(responseExport.headers)}`)
    }

    const requestOptionsExportStatus = {
      url: operationLocation,
      headers: {
        'Ocp-Apim-Subscription-Key': caps.AZURE_CQA_ENDPOINT_KEY
      },
      method: 'GET'
    }
    let responseExportStatus
    for (let tries = 0; tries < 10 * 60 && (!responseExportStatus || ['notStarted', 'partiallyCompleted', 'running'].includes(responseExportStatus.data.status)); tries++) {
      responseExportStatus = await axiosCustomError(requestOptionsExportStatus, 'Export status failed')
      if (responseExportStatus.data.errors?.length > 0) {
        throw new Error(`Export failed with errors: ${JSON.stringify(responseExportStatus.data.errors)}`)
      }

      if (['cancelled', 'cancelling', 'failed'].includes(responseExportStatus.data.status)) {
        throw new Error(`Export failed, job status is: ${responseExportStatus.data.status}`)
      }
      if (responseExportStatus.data.status !== 'succesful') {
        statusCallback(`Try #${tries + 1} done. Upload is not finished yet. Waiting 1s.`)
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    debug(`Last export status: ${JSON.stringify(responseExportStatus.data, null, 2)}`)
  } catch (err) {
    throw new Error(`Export process failed: ${err.message}`)
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
  exportHandler: ({ caps, uploadmode, ...rest } = {}, { convos, utterances } = {}, { statusCallback } = {}) => exportAzureCQAIntents({
    caps,
    uploadmode,
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
    }
  }
}
