'use strict'

const { argv } = require('yargs').options({
  c: {
    alias: 'connections',
    describe: 'number of connections at start of simulation',
    type: 'number',
  },
  d: {
    alias: 'duration',
    describe: 'number of seconds of data collection to simulate',
    type: 'number',
  },
  f: {
    alias: 'file',
    describe:
      'path to write output. If ommitted, `mock` script writes to stdout, `mock-file` script writes to `mock-${Date.now()}`.',
    type: 'string',
  },
  s: {
    alias: 'streams',
    describe: 'number of streams per typical simulated connection',
    type: 'number',
  },
})
const { createWriteStream } = require('fs')

const {
  DEFAULT_STREAMS,
  DEFAULT_CONNECTIONS,
  DEFAULT_DURATION,
  DEFAULT_FILE,
} = require('./utils')
const {
  generateComplete,
  generateConnections,
  generateDHT,
  generateEvent,
  generateRuntime,
  generateStates,
  generateVersion,
} = require('./generate')

const { random } = require('./utils')
const WebSocket = require('ws')
const {
  proto: { ClientSignal },
} = require('@libp2p-observer/proto')

const {
  streams: streamsCount = DEFAULT_STREAMS,
  connections: connectionsCount = DEFAULT_CONNECTIONS,
  duration: durationSeconds = DEFAULT_DURATION,
  file,
  socksrv,
} = argv
const filePath = file === '' ? DEFAULT_FILE : null

if (filePath) {
  console.log(`
    Writing to ${filePath}.
    ${durationSeconds} seconds, ${connectionsCount} initial connections of ~${streamsCount} streams.
  `)
}

if (socksrv) {
  console.log('Starting websocket server on ws://localhost:8080')
  const wss = new WebSocket.Server({ port: 8080 })
  wss.on('connection', ws => {
    // prep and keep peer connections, version, runtime
    let utcTo = Date.now()
    let utcFrom = utcTo - durationSeconds * 1000
    let tmrEmitter = null
    // let tmrEvent = null
    const connections = generateConnections(connectionsCount, utcFrom)
    const dht = generateDHT()
    const version = generateVersion()
    const runtime = generateRuntime()

    function sendEvent({ now = Date.now(), type = '', content = {} } = {}) {
      // send event
      // const _utcFrom = utcTo - 1000
      // const _utcTo = Date.now()
      const event = generateEvent({ now, type, content })
      const data = Buffer.concat([version, event]).toString('binary')
      // if (data) {
      //   utcFrom = _utcFrom
      //   utcTo = _utcTo
      // }
      ws.send(data)
    }

    function sendState() {
      // send states
      const _utcFrom = utcTo - 1000
      const _utcTo = Date.now()
      const states = generateStates(
        connections,
        connectionsCount,
        utcFrom,
        utcTo,
        dht
      )
      // send event when connection is opening
      connections
        .filter(cn => cn.getStatus() === 2)
        .forEach(cn => {
          const ts = utcTo - (random() * 800 + 100)
          sendEvent({
            now: ts,
            type: 'opening',
            content: { peerId: cn.getPeerId() },
          })
        })
      // send event when connection is closing
      connections
        .filter(cn => cn.getStatus() === 3)
        .forEach(cn => {
          const ts = utcTo - (random() * 800 + 100)
          sendEvent({
            now: ts,
            type: 'closing',
            content: { peerId: cn.getPeerId() },
          })
        })
      // state
      const data = states.length
        ? Buffer.concat([version, runtime, ...states]).toString('binary')
        : ''
      if (data) {
        utcFrom = _utcFrom
        utcTo = _utcTo
      }
      setTimeout(() => {
        ws.send(data)
      }, 100)
    }

    // ready signal handler
    ws.on('message', msg => {
      // check client signal
      if (msg) {
        const clientSignal = ClientSignal.deserializeBinary(msg)
        const signal = clientSignal.getSignal()
        if (signal === ClientSignal.Signal.SEND_DATA) {
          sendState()
        } else if (
          signal === ClientSignal.Signal.START_PUSH_EMITTER ||
          signal === ClientSignal.Signal.UNPAUSE_PUSH_EMITTER
        ) {
          tmrEmitter = setInterval(function() {
            sendState()
          }, 1000)
        } else if (
          signal === ClientSignal.Signal.STOP_PUSH_EMITTER ||
          signal === ClientSignal.Signal.PAUSE_PUSH_EMITTER
        ) {
          if (tmrEmitter) {
            clearInterval(tmrEmitter)
          }
        }
      }
    })
    // on connection, send initial packet
    const states = generateStates(
      connections,
      connectionsCount,
      utcFrom,
      utcTo,
      dht
    )
    ws.send(Buffer.concat([version, runtime, ...states]).toString('binary'))
  })
} else {
  const bufferSegments = generateComplete(connectionsCount, durationSeconds)
  const writer = filePath ? createWriteStream(filePath) : process.stdout
  writer.write(bufferSegments)
}
