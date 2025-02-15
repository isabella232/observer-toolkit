# `proto` @libp2p/observer-proto

This package contains [the `.proto` protobuf schema](lib/introspection.proto) shared with the libp2p Introspection module, and the [JavaScript implementation](lib/introspection.proto) of this schema generated with ProtoC, as well as a checksum script, [fnv1a](lib/fnv1a.js) for verifying libp2p Introspection binary.

For more details on the protobuf format and operation, see the [official Google protobuf documentation](https://developers.google.com/protocol-buffers).

<!-- MarkdownTOC -->

- [Usage](#usage)
  - [Using protobuf messages in JavaScript](#using-protobuf-messages-in-javascript)
  - [Updating the protobuf schema](#updating-the-protobuf-schema)
- [Message types](#message-types)
  - [Data messages](#data-messages)
    - [`ServerMessage` messages](#servermessage-messages)
    - [`Runtime` messages](#runtime-messages)
    - [`State` messages](#state-messages)
    - [`Event` messages](#event-messages)
  - [Signal messages](#signal-messages)
    - [`ClientSignal` messages](#clientsignal-messages)

<!-- /MarkdownTOC -->

<a id="usage"></a>
## Usage

<a id="using-protobuf-messages-in-javascript"></a>
### Using protobuf messages in JavaScript

Decoded protobuf objects in JavaScript convert field names in the protobuf schema to camelCase `get` and `set` methods. For example, a field named `version` would be accessed by calling `.getVersion()` on the decoded JavaScript protobuf message.

<a id="updating-the-protobuf-schema"></a>
### Updating the protobuf schema

In the rare event of needing to update the protobuf definition and generated JavaScript implementation, run `npm run protoc` (requires [`protoc`](http://google.github.io/proto-lens/installing-protoc.html)). Ensure that changes are versioned and also mirrored in the libp2p Introspection module.

<a id="message-types"></a>
## Message types

This section gives an overview of the main libp2p Introspection message times and how they inter-relate. See also:

- The [protobuf schema]((lib/introspection.proto)) for the detail on each individual submessage and field
- The [file format documentation](../../docs/file-format.md) for how these binary-encodded messages are packaged
- The [data emitting protocol docs](../../docs/introspection-data-emitting-protocol.md) for how the data server and client interact
- The [console API](../../docs/developer-guide.md#23-accessing-data-in-the-browser-console), which may be used to explore JavaScript-decoded libp2p Introspection message objects in the browser console
- The [data package](../data), which contains JavaScript helper functions performing common operations on decoded libp2p Introspection data, such as making common calculations and extracting deep-nested fields.

<a id="data-messages"></a>
### Data messages

These are sent from the Introspection server to the Observer client.

<a id="servermessage-messages"></a>
#### `ServerMessage` messages

These serve as an outer wrapper for data messages (`state`, `event` and `runtime`) sent from the Introspection server to the Observer client. They carry the version number of the protocol, so that future versions that expand the protobuf definition can maintain backwards compatibility and avoid calling new methods that won't exist in old data.

<a id="runtime-messages"></a>
#### `Runtime` messages

These contain metadata and settings about the libp2p Introspection server and environment. This includes:

 - System metadata such as the `implementation` (e.g. Go, Rust, JavaScript) of libp2p being used, the `version` of that implementation, the `platform` (operating system) it is run on and the `peer_id` of the libp2p node hosting the introspection server.
 - `event_types` lists metadata about types of events that have been observed by the libp2p Introspection server, including properties of these events and data types of those properties. When a new event type is observed, this is updated and a new `Runtime` message is sent.
 - `retention_period_ms` indicates for how long data will be retained before being discarded. The practical implications of this are, on the UI side, the maximum length of the [shell](../shell) timeline and the cutoff point at which the [datastore](../sdk/hooks#usedatastore) allows old data to be garbage collected, and on the server side, the maximum buffer size that should be queued while data is paused.
 - `send_state_interval_ms` indicates how frequently new `State` messages are to be generated by the Introspection server and sent to the Observer.

For both `retention_period_ms` and `send_state_interval_ms`, an Observer user may request a change to this setting by sending config signal messages (for example, from the "Info and settings" panel in the [shell](../shell) UI), and the server may approve or mandate a new setting by sending a new `Runtime` message (for example, if a resource use threshold is exceeded).

<a id="state-messages"></a>
#### `State` messages

These are sent at a regular interval defined in the `Runtime`'s `send_state_interval_ms` field. They give the current state and metrics for a list of `subsystems`, such as `connections` and `dht`, each of which has its own submessage structures.

As well as the `subsystems`, each `State` message carries a `Traffic` submessage summarising all traffic for the host peer, and three timing fields:

 - `instant_ts` - an integer timestamp giving the moment of data collection: when the data in this message is true for.
 - `snapshot_duration_ms` - an integer representing in miliseconds the frequency of state messages at the time this message was generated. Should equal the `Runtime`'s `send_state_interval_ms` field unless that has changed since a state message was generated.
 - `start_ts` - an integer timestamp indicating the time at which data was being collected that contributed to this state message and no previous state message. This is used to show the time span represented by a state message and to indicate any gaps during which there was no data collection and data such as events may have been missed, Normally this will be equal or almost equal to `instant_ts` minus `snapshot_duration_ms`.

 If a state message is missing just one of these three values, the UI's data package `getStateTimes` helper function will estimate it from the other two.

<a id="event-messages"></a>
#### `Event` messages

These are sent immediately on an event being observed by the libp2p Introspection server. The libp2p Observer then updates its datastore immediately, applying a small buffer to prevent excessive UI redraws in cases of extremely high-frequency events.

They contain a `type` that corresponds to a `name` in the `Runtime`'s `event_types` list, a `content` string containing stringified JSON of a schema matching the `property_type`s of the appropriate runtime `event_type`, and an integer timestamp `ts` of the moment the event was observed.

<a id="signal-messages"></a>
### Signal messages

These are sent from the Observer client to the Introspection server.

<a id="clientsignal-messages"></a>
#### `ClientSignal` messages

All signals from the Observer client to the server use this message type. It contains a `version` similar to the `version` of a `ServerMessage` message, a `signal` enum indicating the type of signal, and optional fields specific to signal types.

Signal types available are:

- `SEND_DATA`: requests either a `Runtime` or `State` message from the server, defined by a `data_source` enum field on the signal message. Normally the relationship between Introspection server and Observer client is push-based, but this may be used to emit messages on a pull basis.
- `PAUSE_PUSH_EMITTER`: Requests that the Introspection server stops pushing messages, and instead queues them until an unpause signal is sent.
- `UNPAUSE_PUSH_EMITTER`: Requests that the Introspection server pushes any queued messages and resumes pushing `State` messages according to the `Runtime`'s `send_state_interval_ms` field and pushes `Event` messages as soon as they are available.
- `CONFIG_EMITTER`: Sends a JSON string with instructions on configuration changes for the server to make. If the server does make changes, a new `Runtime` message will be pushed indicating the new settings (which may not exactly match the request - for example if the request would exceed resource limits). Config changes may be:
  - `retention_period_ms` - (number) new value for the `Runtime`'s `retention_period_ms` field
  - `send_state_interval_ms` - (number) new value for the `Runtime`'s `send_state_interval_ms` field.
