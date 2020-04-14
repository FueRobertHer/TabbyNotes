import React, { useState } from 'react';

import Tab from './tab'

function Tabs({tabs, updateTabs, addNewTab}) {
  
  const [activeTab, setActiveTab] = useState(0)
  let currentTab = tabs[activeTab]
  console.log(activeTab, currentTab)
  const [tabTitle, setTabTitle] = useState(tabs[activeTab].title)
  const [tabText, setTabText] = useState(tabs[activeTab].text)

  function saveText(str) {
    const tab = tabs[activeTab]
    const newTab = Object.assign(tab, {text: str})
    tabs[activeTab] = newTab
    setTabText(str)
    updateTabs(tabs)
  }

  function onChangeText(e) {
    const text = e.target.value
    saveText(text)
  }


  function saveTitle(str) {
    setTabTitle(str)
    const tab = tabs[activeTab]
    const newTab = Object.assign(tab, {title: str})
    tabs[activeTab] = newTab
    updateTabs(tabs)
  }

  function clearTab() {
    saveTitle('untitled')
    saveText('')
  }

  function setTab(idx) {
    console.log(idx)
    setActiveTab(idx)
    const newTitle = tabs[idx].title
    const newText = tabs[idx].text
    setTabTitle(newTitle)
    setTabText(newText)
    document.getElementById('text').value = newText
  }

  function deleteTab(idx) {
    if (tabs.length === 1) {
      clearTab()
      return
    }
    const newTabState = [...tabs]
    newTabState.splice(idx, 1)
    let newIdx = activeTab
    if (activeTab >= newTabState.length) {
      newIdx = newTabState.length - 1
    }
    setTab(newIdx)
    updateTabs(newTabState)
  }

  function showTabs() {
    return (
      tabs.map((tab,idx) => {
        return (
          <Tab 
            tab={tab} 
            idx={idx} 
            activeTab={activeTab}
            setTab={setTab}
            deleteTab={deleteTab}
            saveTitle={saveTitle}
            clearTab={clearTab}
          />
        )
      })
    )
  }

  return (
    <div className = "App" >
      <nav className='nav'>
        {showTabs()}

        <button className='tab new-tab' onClick={addNewTab}>+</button>
      </nav>
      <body className='body'>
        <textarea id='text' onChange={onChangeText} wrap='soft'>{tabText}</textarea>
      </body>

      <footer className="credit">
        Made with love by <a href="https://github.com/FueRobertHer" target="_blank">Fue Her</a>
      </footer>
    </div>
  )
};

export default Tabs