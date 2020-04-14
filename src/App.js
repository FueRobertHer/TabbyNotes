import React, { useState } from 'react';

import Tabs from './tabs'

import './App.css';

document.addEventListener('keydown', (e) => {
  const textEle = document.getElementById('text')
  if (document.activeElement === textEle && e.key === 'Tab') {
    e.preventDefault()
    let start = textEle.selectionStart
    let end = textEle.selectionEnd
    let text = textEle.value
    textEle.value = text.substr(0, start) + '	' + text.substr(end, text.length)
  }
})

function App() {
  const test = {
    title: 'hello',
    text: 'world'
  }

  let saveState = JSON.parse(window.localStorage.getItem('saveState'))
  if (!saveState) saveState = {tabs: [{title: 'untitled', text: ''}]}

  const loadState = {tabs: [test]}

  const [state, setState] = useState(saveState)
  const [tabsState, setTabsState] = useState([...state.tabs])

  function updateState(obj) {
    const newState = Object.assign(state, obj)
    setState(newState)
    console.log('state', newState)

    window.localStorage.setItem('saveState', JSON.stringify(state))
  }

  function updateTabs(tabState) {
    const newTabState = [...tabState]
    console.log('tabs', newTabState)
    setTabsState(newTabState)
    updateState({tabs: newTabState})
  }

  function addNewTab() {
    const newTab = {title: 'untitled', text: ''}
    const newTabs = [...state.tabs]
    newTabs.push(newTab)
    updateTabs(newTabs)
  }

  return (
    <Tabs 
      tabs={tabsState} 
      updateTabs={updateTabs}
      addNewTab={addNewTab}
    />
  );
}

export default App;
