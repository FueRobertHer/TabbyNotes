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
  if (!saveState) saveState = {tabs: [{title: 'untitled', text: ''}], activeTab: 0}

  const [state, setState] = useState(saveState)
  const [tabsState, setTabsState] = useState([...state.tabs])
  const [activeTab, setActiveTab] = useState(state.activeTab)


  function updateState(obj) {
    const newState = Object.assign(state, obj)
    setState(newState)

    window.localStorage.setItem('saveState', JSON.stringify(state))
  }

  function updateTabs(tabState) {
    const newTabState = [...tabState]
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
      activeTab={activeTab}
      setActiveTab={setActiveTab}
    />
  );
}

export default App;
