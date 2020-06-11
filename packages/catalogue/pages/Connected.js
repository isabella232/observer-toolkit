import React from 'react'
import styled from 'styled-components'
import T from 'prop-types'

import { RootNodeProvider } from '@nearform/observer-sdk'
import { ControlPanel } from '@nearform/observer-shell'

import CatalogueItem from '../components/CatalogueItem'
import Header from '../components/Header'

const Container = styled.div`
  font-family: plex-sans, sans-serif;
  position: fixed;
  display: flex;
  flex-direction: column;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
`

const ScrollArea = styled.div`
  overflow-y: scroll;
  flex-grow: 1;
  flex-shrink: 1;
`

const Main = styled.div`
  padding: ${({ theme }) => theme.spacing([2, 1])};
  background-color: ${({ theme }) => theme.color('background', 1)};
  position: relative;
`

const CatalogueBkg = styled.div`
  display: flex;
`

function Connected({ widgets, widgetIndex, setWidgetIndex, content, title }) {
  const selectedWidget = widgets[widgetIndex] || null
  const closeWidget = () => setWidgetIndex(null)

  return (
    <Container>
      <ScrollArea>
        <Header content={content} title={title} />
        <Main>
          <RootNodeProvider>
            {selectedWidget ? (
              <selectedWidget.Widget closeWidget={closeWidget} />
            ) : (
              <CatalogueBkg>
                {widgets.map(
                  ({ name, description, tags, screenshot }, index) => (
                    <CatalogueItem
                      key={name}
                      name={name}
                      description={description}
                      tags={tags}
                      screenshot={screenshot}
                      handleSelect={() =>
                        setWidgetIndex(index === widgetIndex ? null : index)
                      }
                      isSelected={widgetIndex === index}
                    />
                  )
                )}
              </CatalogueBkg>
            )}
          </RootNodeProvider>
        </Main>
      </ScrollArea>
      <ControlPanel />
    </Container>
  )
}
Connected.propTypes = {
  widgets: T.array.isRequired,
  widgetIndex: T.number,
  setWidgetIndex: T.func.isRequired,
  content: T.array,
  title: T.string,
}

export default Connected
