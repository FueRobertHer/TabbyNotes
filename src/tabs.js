import React, { useRef } from 'react';
import { useStateContext } from './StateContextProvider';
import Tab from './tab'

const Tabs = (props) => {
  const {state, dispatch} = useStateContext();
  const navRef = useRef(null);

  const onWheel = (e) => {
    e.preventDefault();
    let scrollPosition = navRef.current.scrollLeft;
    if (e.deltaX === 0) {
      navRef.current.scrollTo({
        top: 0,
        left: scrollPosition + e.deltaY
      })
    }
  }

  const onChange = (e) => {
    dispatch({
      type: "UPDATE",
      payload: {
        tabIdx: state.activeTab,
        text: e.target.value
      }
    })
  }

  const addTab = () => {
    dispatch({
      type: "ADD_TAB",
    })
  }

  return (
    <>
      <nav className='nav' ref={navRef} onWheel={onWheel}>
        {state.tabs.map((_,idx) => 
          <Tab 
            key={'tab-' + idx}
            idx={idx} 
          />
        )}
        <button className='tab new-tab' onClick={addTab}>+</button>
      </nav>

      <div className='body'>
        <textarea 
          id='text' 
          wrap='soft' 
          value={state.tabs[state.activeTab].text}
          onChange={onChange}
        ></textarea>
      </div>

      <footer className="credit">
        Made with love by <a href="https://github.com/FueRobertHer" rel='noopener noreferrer' target="_blank">Fue Her</a>
      </footer>
    </>
  )
};

export default Tabs