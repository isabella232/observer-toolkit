import React, { useContext } from 'react'

import { getTime } from '@libp2p-observer/data'
import {
  DataTable,
  EventsContext,
  TimeContext,
  useTabularData,
} from '@libp2p-observer/sdk'

import eventsColumnDefs from '../definitions/eventsColumns'

function EventsTable() {
  const timepoint = useContext(TimeContext)
  const time = getTime(timepoint)
  const allEvents = useContext(EventsContext)
  const eventsData = allEvents.filter(
    event => event.getTs().getSeconds() <= time
  )

  const rowsPerPageOptions = [10, 25, 50, 100]
  const defaultPerPageIndex = 0

  const {
    columnDefs,
    allContent,
    shownContent,
    sortColumn,
    setSortColumn,
    sortDirection,
    setSortDirection,
    setRange,
    rowCounts,
  } = useTabularData({
    columns: eventsColumnDefs,
    data: eventsData,
    defaultSort: 'time',
    defaultRange: [0, rowsPerPageOptions[defaultPerPageIndex]],
  })

  return (
    <DataTable
      allContent={allContent}
      shownContent={shownContent}
      columnDefs={columnDefs}
      sortColumn={sortColumn}
      setSortColumn={setSortColumn}
      sortDirection={sortDirection}
      setSortDirection={setSortDirection}
      setRange={setRange}
      rowCounts={rowCounts}
      rowsPerPageOptions={rowsPerPageOptions}
      defaultPerPageIndex={defaultPerPageIndex}
      hasPagination
    />
  )
}

export default EventsTable
