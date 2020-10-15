import React from 'react';
import { useStateContext } from './StateContextProvider';

const Tab = ({idx}) => {
  const {state, dispatch} = useStateContext();

  let active = ''
  if (state.activeTab === idx) {
    active += ' tab-active'
  }

  const updateTitle = (e) => {
    e.preventDefault();
    const newTitle = window.prompt(`Enter a new title`, state.tabs[idx].title);
    if (!newTitle || newTitle.length === 0) return;
    dispatch({
      type: "UPDATE",
      payload: {
        tabIdx: idx,
        title: newTitle
      }
    })
  }

  const openTab = (e) => {
    if (e.target.className === "delete") return;
    dispatch({
      type: "CHANGE_TAB",
      payload: {
        tabIdx: idx
      }
    })
  }

  const nextTab = () => {
    if (state.activeTab !== idx) return idx;
    if (idx === 0) return 0;
    return idx - 1;
  }

  const deleteTab = () => {
    const next = nextTab()
    dispatch({
      type: "DELETE_TAB",
      payload: {
        tabIdx: idx,
        activeTab: next
      }
    })
  }

  const clear = () => {
    dispatch({
      type: "UPDATE",
      payload: {
        tabIdx: idx,
        text: '',
        title: "new"
      }
    })
  }
  
  const deleteOrClear = () => {
    if (state.tabs.length === 1 && idx === 0) {
      clear();
    } else {
      deleteTab();
    }
  }

  const openOrDelTab = (e) => {
    if (e.which == 2) deleteOrClear();
    openTab(e);
  }
  
  const deleteBtn = () => {
    if (state.activeTab === idx) {
      return <span 
        className='delete' 
        onClick={deleteOrClear}
      >✖</span>
    }
  }

  return (
    <span 
      className={'tab' + active} 
      onClick={openOrDelTab} 
      onContextMenu={updateTitle}
    >
      <label id={idx}>
        {state.tabs[idx].title}
      </label>

      {deleteBtn()}
    </span>
  )
};

export default Tab