import React from 'react'
import T from 'prop-types'
import styled from 'styled-components'
import { timeFormat } from 'd3'

import { Icon, PeerIdChip, Tooltip } from '@libp2p/observer-sdk'
import { getRenderer } from '../utils/buildEventsColumns'
const timeFormatter = timeFormat('%H:%M:%S.%L')

const Nowrap = styled.span`
  white-space: nowrap;
`

const rendererPropType = {
  value: T.oneOfType([T.number, T.string]),
  type: T.string, // Event type
}

const ExpandIcon = styled.span`
  transform: rotate(90deg);
  margin-right: ${({ theme }) => theme.spacing(-1)};
  [data-tooltip='open'] > span > & {
    transform: rotate(180deg);
  }
  ${({ theme }) => theme.transition({ property: 'transform' })}
`

function RenderMultiple({ value, type, name, hidePrevious }) {
  if (!value) return ''

  const cellText = `${value.length} ${name}`
  if (!value.length) {
    return cellText
  }

  const renderer = getRenderer(type)
  const { renderContent: RenderContent } = renderer
  return (
    <Tooltip
      side="bottom"
      fixOn="no-hover"
      toleranceY={null}
      toleranceX={-32}
      hidePrevious={hidePrevious}
      content={value.map((item, i) => (
        <RenderContent value={item} key={i} />
      ))}
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
  hidePrevious: T.func,
}

function RenderString({ value }) {
  return value
}
RenderString.propTypes = rendererPropType

function RenderNumber({ value }) {
  return value
}
RenderNumber.propTypes = rendererPropType

function RenderPeerId({ value }) {
  return value ? <PeerIdChip peerId={value} /> : ''
}
RenderPeerId.propTypes = rendererPropType

function RenderTime({ value }) {
  return value ? <Nowrap>{timeFormatter(value)}</Nowrap> : ''
}
RenderTime.propTypes = rendererPropType

export { RenderString, RenderPeerId, RenderTime, RenderNumber, RenderMultiple }
