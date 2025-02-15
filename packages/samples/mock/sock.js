'use strict'

const http = require('http')
const WebSocket = require('ws')
const {
  proto: { ClientCommand, Configuration },
} = require('@libp2p/observer-proto')
const { DEFAULT_SNAPSHOT_DURATION } = require('./utils')
const {
  generateCommandResponse,
  generateConnections,
  generateConnectionEvents,
  // generateEventsFlood,
  generateDHT,
  generateRuntime,
  generateState,
  generateVersion,
  updateConnections,
  updateDHT,
} = require('./generate')
const { createRuntime } = require('./messages/runtime')

const connections = []
const version = generateVersion()
const server = http.createServer()
const wss = new WebSocket.Server({ noServer: true })

const msgQueue = []

let runtime
let dht
let sendInterval
let generateInterval

let pushEvents = false
let pushStates = false

let effectiveConfig

function generateMessages({
  connectionsCount,
  duration: durationSnapshot,
  peersCount,
  cutoffSeconds,
}) {
  const utcNow = Date.now()
  const utcFrom = utcNow
  const utcTo = utcNow + durationSnapshot

  if (!dht) dht = generateDHT({ peersCount })

  if (!runtime) {
    runtime = createRuntime({}, [
      'PeerConnecting',
      'PeerDisconnecting',
      'OutboundDHTQuery',
    ])
  }

  if (!connections.length) {
    connections.length = 0
    const conns = generateConnections(
      connectionsCount,
      utcNow - durationSnapshot
    )
    updateConnections(conns, null, utcFrom, durationSnapshot, cutoffSeconds)
    connections.push(...conns)
    return
  }

  updateConnections(
    connections,
    connectionsCount,
    utcTo,
    durationSnapshot,
    cutoffSeconds
  )
  updateDHT({
    dht,
    connections,
    utcFrom,
    utcTo,
    msgQueue,
    version,
    pushEvents,
    runtime,
  })

  generateConnectionEvents({
    connections,
    msgQueue,
    utcNow,
    version,
    runtime,
    durationSnapshot,
    pushEvents,
  })

  if (pushStates) {
    const statePacket = generateState(
      connections,
      utcNow,
      dht,
      durationSnapshot
    )
    const data = Buffer.concat([version, statePacket]).toString('binary')
    msgQueue.push({ ts: utcTo, type: 'state', data })
  }
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

function handleClientMessage(ws, server, clientCommand, props) {
  let sendEmptyOKResponse = true

  const command = clientCommand.getCommand()
  const commandId = clientCommand.getId()
  const commandSource = clientCommand.getSource()

  if (command === ClientCommand.Command.REQUEST) {
    if (commandSource === ClientCommand.Source.RUNTIME) {
      console.log('Sending requested runtime')
      sendRuntime()
    } else {
      console.log('Sending requested messages')
      generateMessages(props)
      sendQueue(ws)
    }
  } else if (command === ClientCommand.Command.PUSH_ENABLE) {
    if (commandSource === ClientCommand.Source.STATE) pushStates = true
    if (commandSource === ClientCommand.Source.EVENTS) pushEvents = true
  } else if (command === ClientCommand.Command.PUSH_DISABLE) {
    if (commandSource === ClientCommand.Source.STATE) pushStates = false
    if (commandSource === ClientCommand.Source.EVENTS) pushEvents = false
  } else if (command === ClientCommand.Command.PUSH_RESUME) {
    clearInterval(sendInterval)
    sendInterval = setInterval(() => {
      sendQueue(ws)
    }, 200)
  } else if (command === ClientCommand.Command.PUSH_PAUSE) {
    clearInterval(sendInterval)
  } else if (
    command === ClientCommand.Command.UPDATE_CONFIG ||
    command === ClientCommand.Command.HELLO
  ) {
    const newConfig = clientCommand.getConfig()
    if (newConfig) {
      updateConfig(newConfig, commandId, ws, server)
      sendEmptyOKResponse = false
    } else if (command === ClientCommand.Command.HELLO) {
      // Send default config
      sendCommandResponse(
        {
          id: commandId,
          effectiveConfig,
        },
        ws
      )
      sendEmptyOKResponse = false
    }
  } else {
    sendCommandResponse(
      {
        id: commandId,
        error: `Command ${command} ("${ClientCommand.Command[command]}") unrecognised by server`,
      },
      ws
    )

    sendEmptyOKResponse = false
  }

  if (sendEmptyOKResponse) {
    sendCommandResponse(
      {
        id: commandId,
      },
      ws
    )
  }
}

function updateConfig(newConfig, commandId, ws, server) {
  let hasChanged = false

  const newStateInterval = newConfig.getStateSnapshotIntervalMs()
  const newRetentionPeriod = newConfig.getRetentionPeriodMs()

  if (newStateInterval) {
    clearInterval(server.generator)
    server.generator = setInterval(() => {
      generateMessages({
        connectionsCount: server.connectionsCount,
        duration: newStateInterval,
      })
    }, newStateInterval)
    hasChanged = true
    effectiveConfig.setStateSnapshotIntervalMs(newStateInterval)
  }
  if (newRetentionPeriod) {
    hasChanged = true
    effectiveConfig.setRetentionPeriodMs(newRetentionPeriod)
  }
  if (hasChanged) {
    sendCommandResponse(
      {
        id: commandId,
        effectiveConfig,
      },
      ws
    )
  }
}

function sendRuntime(attempts = 0) {
  if (!runtime) {
    // If connection requests runtime before runtime generated, wait and try again
    if (attempts < 20) setTimeout(() => sendRuntime(attempts + 1), 500)
    return
  }
  const runtimePacket = generateRuntime({}, runtime)
  const data = Buffer.concat([version, runtimePacket]).toString('binary')
  msgQueue.push({ ts: Date.now(), type: 'runtime', data })
}

function sendCommandResponse(props, ws) {
  const responsePacket = generateCommandResponse(props)
  const data = Buffer.concat([version, responsePacket]).toString('binary')
  ws.send(data)
}

function start(props = {}) {
  let {
    connectionsCount = 0,
    duration = DEFAULT_SNAPSHOT_DURATION,
    peersCount,
    cutoffSeconds,
  } = props

  if (effectiveConfig) {
    duration = effectiveConfig.getStateSnapshotIntervalMs()
    cutoffSeconds = effectiveConfig.getRetentionPeriodMs() / 1000
  } else {
    effectiveConfig = new Configuration()
    effectiveConfig.setStateSnapshotIntervalMs(duration)
    effectiveConfig.setRetentionPeriodMs(cutoffSeconds * 1000)
  }

  wss.connectionsCount = connectionsCount

  clearInterval(generateInterval)
  clearInterval(sendInterval)
  generateInterval = setInterval(() => {
    generateMessages({ connectionsCount, peersCount, duration, cutoffSeconds })
  }, duration)
  wss.generator = generateInterval

  // handle messages
  wss.on('connection', ws => {
    // allow only 1 client connection, it's just a mock server
    wss.clients.forEach(client => {
      if (client === ws) {
        clearInterval(sendInterval)
        sendInterval = setInterval(() => {
          sendQueue(client)
        }, 200)
      } else {
        console.error(
          'Closing previous connection! Only 1 allowed for mock server.'
        )
        client.close()
      }
    })
    // handle incoming messages
    ws.on('message', msg => {
      if (!msg) return
      const command = ClientCommand.deserializeBinary(msg)
      try {
        handleClientMessage(ws, wss, command, props)
      } catch (err) {
        sendCommandResponse(
          {
            id: command.getId(),
            error: err.toString(),
          },
          ws
        )
        throw err
      }
    })

    sendRuntime()
  })

  server.on('upgrade', function upgrade(request, socket, head) {
    wss.handleUpgrade(request, socket, head, function done(ws) {
      wss.emit('connection', ws, request)
    })
  })

  // listen for connections
  server.listen(8080, err => {
    if (err) {
      console.error(err)
    } else {
      console.log('Websocket server listening on ws://localhost:8080')
    }
  })
}

module.exports = {
  start,
}
