import React, { useState } from 'react';

function Tab({tab, idx, activeTab, setTab, deleteTab, saveTitle}) {
  
  const [title, setTitle] = useState(tab.title)

  let active = ''
  if (activeTab === idx) {
    active += ' tab-active'
  }

  function updateTitle(e) {
    e.preventDefault()
    const placeholder = title || ''
    const newTitle = prompt('Enter new title', placeholder) || title
    setTitle(newTitle)
    saveTitle(newTitle)
  }

  function tabClick(e) {
    if(e.target.className !== 'delete') {
      setTab(idx)
      setTitle(tab.title)
      document.getElementById('text').focus()
    }
  }

  function deleteSelf() {
    let newIdx = idx - 1
    if (newIdx < 0) newIdx = 0
    setTab(newIdx)
    deleteTab(idx)
  }

  function deleteBtn() {
    if (activeTab === idx) {
      return(
        <span className='delete' onClick={deleteSelf}>✖</span>
      )
    }
  }

  return (
    <span className={'tab' + active} onClick={tabClick} onContextMenu={updateTitle}>
      <label id={idx}>
        {title}
      </label>

      {deleteBtn()}
    </span>
  )
};

export default Tab