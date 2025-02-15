import React, { useEffect, useRef } from 'react'
import T from 'prop-types'
import styled from 'styled-components'

import { Table, TBody } from './styledTable'
import DataTableRow from './DataTableRow'

const Container = styled.div`
  background: ${({ theme }) => theme.color('background')};
  position: absolute;
  width: 100%;
`

function SlidingRow({
  rowContent,
  columnDefs,
  yFrom,
  yTo,
  slideDuration,
  fadeOut = false,
  override = {},
}) {
  const slideRef = useRef()

  const RowRenderer = override.DataTableRow || DataTableRow

  const distanceMoved = Math.abs(yFrom - yTo)

  useEffect(() => {
    let timeout
    if (slideRef.current) {
      slideRef.current.style.transition = ''
      slideRef.current.style.transform = `translateY(${yFrom}px)`
      slideRef.current.style.opacity = 1
      timeout = setTimeout(() => {
        if (slideRef.current) {
          slideRef.current.style.transition = `${slideDuration}ms all ease-in-out`
          slideRef.current.style.transform = `translateY(${yTo}px)`
          slideRef.current.style.opacity = fadeOut ? 0 : 1
        }
      })
    }
    return () => timeout && clearTimeout(timeout)
  })

  return (
    <Container ref={slideRef} distanceMoved={distanceMoved} role="presentation">
      <Table as={override.Table}>
        <TBody as={override.TBody}>
          <RowRenderer rowContent={rowContent} columnDefs={columnDefs} />
        </TBody>
      </Table>
    </Container>
  )
}

SlidingRow.propTypes = {
  rowContent: T.array.isRequired,
  columnDefs: T.array.isRequired,
  yFrom: T.number,
  yTo: T.number,
  slideDuration: T.number,
  fadeOut: T.bool,
  override: T.object,
}

export default SlidingRow
