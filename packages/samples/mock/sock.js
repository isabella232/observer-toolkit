'use strict'

const http = require('http')
const WebSocket = require('ws')
const {
  proto: { ClientSignal },
} = require('@libp2p-observer/proto')
const { DEFAULT_SNAPSHOT_DURATION, random } = require('./utils')
const {
  generateConnections,
  generateConnectionEvents,
  generateDHT,
  generateRuntime,
  generateState,
  generateVersion,
  updateConnections,
  updateDHT,
} = require('./generate')

const connections = []
const version = generateVersion()
const runtime = generateRuntime()
const server = http.createServer()
const wss = new WebSocket.Server({ noServer: true })
// let tmrMessages
// let tmrQueueProcess

const msgQueue = []

function generateMessages({ connectionsCount, durationSnapshot, peersCount }) {
  const utcNow = Date.now()
  const utcFrom = utcNow
  const utcTo = utcNow + durationSnapshot
  const dht = generateDHT({ peersCount })

  if (!connections.length) {
    connections.length = 0
    const conns = generateConnections(connectionsCount, utcNow - durationSnapshot)
    updateConnections(conns, null, utcFrom, durationSnapshot)
    connections.push(...conns)
    return
  }

  updateConnections(connections, connectionsCount, utcTo, durationSnapshot)
  updateDHT({ dht, connections, utcFrom, utcTo, msgQueue, version })

  generateConnectionEvents({
    connections,
    msgQueue,
    utcNow,
    version,
    runtime,
    durationSnapshot,
  })

  const state = generateState(connections, utcTo, dht)
  const data = Buffer.concat([version, runtime, state]).toString('binary')
  msgQueue.push({ ts: utcTo, type: 'state', data })
}

function sendQueue(ws) {
  const utcNow = Date.now()
  const queue = []
  msgQueue.forEach((item, idx) => {
    queue.push(msgQueue.splice(idx, 1)[0])
  })

  queue
    .sort((a, b) => a.ts - b.ts)
    .forEach(item => {
      setTimeout(() => {
        ws.send(item.data)
      }, Math.max(0, item.ts - utcNow))
    })
}

function handleClientMessage(ws, msg) {
  // check client signal
  if (msg) {
    const clientSignal = ClientSignal.deserializeBinary(msg)
    const signal = clientSignal.getSignal()
    if (signal === ClientSignal.Signal.SEND_DATA) {
      sendQueue(ws)
    } else if (
      signal === ClientSignal.Signal.START_PUSH_EMITTER ||
      signal === ClientSignal.Signal.UNPAUSE_PUSH_EMITTER
    ) {
      // TODO: implement unpause/start diff of timer emitter
      setInterval(() => {
        sendQueue(ws)
      }, 200)
    } else if (
      signal === ClientSignal.Signal.STOP_PUSH_EMITTER ||
      signal === ClientSignal.Signal.PAUSE_PUSH_EMITTER
    ) {
      // TODO: implement pause/stop of timer emitter
    }
  }
}

function start({ connectionsCount = 0, duration = DEFAULT_SNAPSHOT_DURATION, peersCount } = {}) {
  // generate states
  setInterval(() => {
    generateMessages({ connectionsCount, peersCount, duration })
  }, duration)

  // handle messages
  wss.on('connection', ws => {
    ws.on('message', msg => {
      handleClientMessage(ws, msg)
    })
  })

  server.on('upgrade', function upgrade(request, socket, head) {
    wss.handleUpgrade(request, socket, head, function done(ws) {
      wss.emit('connection', ws, request)
    })
  })

  // listen for connections
  server.listen(8080, () => {
    console.log('Websocket server listening on ws://localhost:8080')
  })
}

module.exports = {
  start,
}
