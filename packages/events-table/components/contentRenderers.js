import React from 'react'
import T from 'prop-types'
import styled from 'styled-components'
import { timeFormat } from 'd3'

import { Icon, PeerIdChip, Tooltip } from '@libp2p-observer/sdk'
import { getRenderer } from '../utils/buildEventsColumns'
const timeFormatter = timeFormat('%H:%M:%S.%L')

const Nowrap = styled.span`
  white-space: nowrap;
`

const RawJson = styled.pre`
  padding: ${({ theme }) => theme.spacing(0.5)};
  background: ${({ theme }) => theme.color('background', 1)};
  font-family: 'plex-mono';
`

const rendererPropType = {
  value: T.oneOfType([T.number, T.string]).isRequired,
  type: T.string, // Event type
}

const ExpandIcon = styled.span`
  transform: rotate(90deg);
  margin-right: ${({ theme }) => theme.spacing(-1)};
  [data-tooltip='open'] > button > & {
    transform: rotate(180deg);
  }
  ${({ theme }) => theme.transition({ property: 'transform' })}
`

function RenderMultiple({ value, type, name }) {
  const cellText = `${value.length} ${name}`
  if (!value.length) {
    return cellText
  }

  const renderer = getRenderer(type)
  console.log({ renderer })
  const { renderContent } = renderer
  return (
    <Tooltip
      side="bottom"
      fixOn="no-hover"
      toleranceY={null}
      toleranceX={-32}
      content={value.map(item => renderContent({ value: item }))}
    >
      <Nowrap>
        {cellText}
        <Icon type="expand" override={{ Container: ExpandIcon }} />
      </Nowrap>
    </Tooltip>
  )
}
RenderMultiple.propTypes = {
  value: T.array.isRequired,
  type: T.string.isRequired,
  name: T.string.isRequired,
}

function RenderString({ value }) {
  return value
}
RenderString.propTypes = rendererPropType

function RenderNumber({ value }) {
  return value
}
RenderNumber.propTypes = rendererPropType

function RenderJson({ value }) {
  return value ? <RawJson>{value}</RawJson> : ''
}
RenderJson.propTypes = rendererPropType

function RenderPeerId({ value }) {
  return value ? <PeerIdChip peerId={value} /> : ''
}
RenderPeerId.propTypes = rendererPropType

function RenderTime({ value }) {
  return value ? <Nowrap>{timeFormatter(value)}</Nowrap> : ''
}
RenderTime.propTypes = rendererPropType

export {
  RenderString,
  RenderJson,
  RenderPeerId,
  RenderTime,
  RenderNumber,
  RenderMultiple,
}
