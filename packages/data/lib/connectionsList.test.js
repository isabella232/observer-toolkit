import { proto } from '@libp2p/observer-proto'
import { loadSample } from '@libp2p/observer-testing'

import {
  getAllConnections,
  getAllStreamsAtTime,
  getConnections,
  getConnectionTraffic,
  getConnectionAge,
  getStreamAge,
  getStreamTraffic,
} from './connectionsList'

import { getLatestState } from './states'

const { Connection } = proto
const {
  data: { states },
} = loadSample()

function getClassProps(instance) {
  // To use for class matching of protobuf classes instead of toBeInstanceOf
  // They can't be matched with instanceof because they lack a name property
  return Object.keys(Object.getPrototypeOf(instance).constructor)
}

if (!states.length)
  throw new Error('Deserialization error prevents testing helpers')

describe('connectionsList data helpers', () => {
  it('gets connection data from sample protobuf file', () => {
    const allConnections = getAllConnections(states)
    expect(allConnections).toBeInstanceOf(Array)

    const allConnectionIds_1 = new Set(
      allConnections.map(connection => {
        // Check getAllConnections against getConnections to ensure it gets every connection exactly once
        expect(getClassProps(connection)).toEqual(Object.keys(Connection))
        return connection.getId().toString()
      })
    )

    const allConnectionIds_2 = new Set()

    for (const state of states) {
      const connections = getConnections(state)
      expect(connections).toBeInstanceOf(Array)

      expect(
        connections.length <= allConnections.length,
        'No state should contain more connections than total'
      ).toBeTruthy()

      for (const connection of connections) {
        expect(getClassProps(connection)).toEqual(Object.keys(Connection))
        const id = connection.getId()

        allConnectionIds_2.add(id.toString())
      }
    }

    expect(allConnectionIds_1).toEqual(allConnectionIds_2)
    expect(
      allConnectionIds_1.size,
      'Each connection should have a unique id'
    ).toBe(allConnections.length)
  })

  it('gets stream data from sample protobuf file', () => {
    for (const state of states) {
      const allStreamsWithConnection = getAllStreamsAtTime(state)
      const streamIds_1 = new Set(
        allStreamsWithConnection.map(({ stream }) => stream.getId().toString())
      )

      const streamIds_2 = new Set()
      let connStreamMismatches = 0
      for (const connection of getConnections(state)) {
        const streams = connection.getStreams().getStreamsList()
        for (const stream of streams) {
          streamIds_2.add(stream.getId().toString())

          const connStreamPair = allStreamsWithConnection.find(
            pair => stream.getId() === pair.stream.getId()
          )
          const pairConnId = connStreamPair.connection.getId().toString()
          if (connection.getId().toString() !== pairConnId)
            connStreamMismatches++
        }
      }

      expect(connStreamMismatches).toBe(0)
      expect(streamIds_1).toEqual(streamIds_2)
      expect(streamIds_1.size, 'Each stream should have a unique id').toBe(
        allStreamsWithConnection.length
      )
    }
  })

  it('gets traffic and age data from streams and connections', () => {
    const connections = new Set()

    const state = getLatestState(states)
    const allStreamsWithConnection = getAllStreamsAtTime(state)
    for (const { connection, stream } of allStreamsWithConnection) {
      // Traffic - streams
      const bytesIn = getStreamTraffic(stream, 'in', 'bytes')
      expect(typeof bytesIn).toBe('number')
      expect(bytesIn >= 0).toBeTruthy()

      const bytesOut = getStreamTraffic(stream, 'out', 'bytes')
      expect(typeof bytesOut).toBe('number')
      expect(bytesOut >= 0).toBeTruthy()

      const packetsIn = getStreamTraffic(stream, 'in', 'packets')
      expect(typeof packetsIn).toBe('number')
      expect(packetsIn >= 0).toBeTruthy()

      const packetsOut = getStreamTraffic(stream, 'out', 'packets')
      expect(typeof packetsOut).toBe('number')
      expect(packetsOut >= 0).toBeTruthy()

      // Traffic - connections
      if (!connections.has(connection)) {
        connections.add(connection)

        const bytesIn = getConnectionTraffic(connection, 'in', 'bytes')
        expect(typeof bytesIn).toBe('number')
        expect(bytesIn >= 0).toBeTruthy()

        const bytesOut = getConnectionTraffic(connection, 'out', 'bytes')
        expect(typeof bytesOut).toBe('number')
        expect(bytesOut >= 0).toBeTruthy()

        const packetsIn = getConnectionTraffic(connection, 'in', 'packets')
        expect(typeof packetsIn).toBe('number')
        expect(packetsIn >= 0).toBeTruthy()

        const packetsOut = getConnectionTraffic(connection, 'out', 'packets')
        expect(typeof packetsOut).toBe('number')
        expect(packetsOut >= 0).toBeTruthy()
      }

      // Age
      const connectionAge = getConnectionAge(connection, state)
      expect(typeof connectionAge).toBe('number')
      expect(connectionAge >= 0).toBeTruthy()

      const streamAge = getStreamAge(stream, state)
      expect(typeof streamAge).toBe('number')
      expect(streamAge >= 0).toBeTruthy()
    }
  })
})
