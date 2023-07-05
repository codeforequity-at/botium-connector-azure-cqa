require('dotenv').config()
const assert = require('chai').assert
const { importHandler } = require('../../src/intents')
const { readCaps } = require('./helper')

describe('importhandler', function () {
  beforeEach(async function () {
    this.caps = readCaps()
  })
  it('should successfully download intents', async function () {
    const result = await importHandler({ caps: this.caps })
    assert.isAtLeast(result.convos?.length, 1)
    assert.equal(result.convos[0].conversation[0].sender, 'me')
    assert.equal(result.convos[0].conversation[0].messageText, 'UTT_HELLO')

    assert.equal(result.convos[0].conversation[1].sender, 'bot')
    assert.equal(result.convos[0].conversation[1].messageText, 'hello human')

    const utterance = result.utterances.find(u => (u.name === 'UTT_HELLO'))

    assert.isTrue(!!utterance, '"UTT_HELLO" intent not found')
    assert.equal(utterance.name, 'UTT_HELLO')
    assert.isTrue(utterance.utterances.includes('UTT_HELLO'))
    assert.isTrue(utterance.utterances.includes('hi'))
    assert.isTrue(utterance.utterances.includes('hello'))
  }).timeout(100000)
})
