require('dotenv').config()
const { exportHandler } = require('../../src/intents')
const { readCaps } = require('./helper')

describe('exporthandler', function () {
  beforeEach(async function () {
    this.caps = readCaps()
  })
  it('should successfully upload existing utterances', async function () {
    await exportHandler({ caps: this.caps }, {
      utterances: [
        {
          name: 'UTT_HELLO',
          utterances: ['hi', 'hello']
        },
        {
          name: 'NOT EXISTING ANS SO SKIPPED INTENT',
          utterances: ['1', '2']
        }
      ],
      convos: [
        {
          header: {
            name: 'UTT_HELLO'
          },
          conversation: [
            {
              sender: 'me',
              messageText: 'UTT_HELLO'
            },
            {
              sender: 'bot',
              messageText: 'hello human',
              asserters: [
                {
                  name: 'INTENT',
                  args: [
                    'UTT_HELLO'
                  ]
                }
              ]
            }
          ]
        }
      ]
    }, {
      statusCallback: (data) => console.log(data)
    })
  }).timeout(50000)
})
