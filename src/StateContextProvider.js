import React, { createContext, useContext, useReducer } from 'react';
import reducer from './reducer';

const StateContext = createContext();

export const useStateContext = () => {
  const context = useContext(StateContext);
  if (!context) throw new Error("This component isn't nested under a context provider")
  return context;
}

const initialState = {
  tabs: [
    {
      title: 'new',
      text: ''
    }
  ], 
  activeTab: 0
}

const loadedState = JSON.parse(window.localStorage.getItem("saveState")) || initialState;
const StateContextProvider = (props) => {
  const [state, dispatch] = useReducer(reducer, loadedState);

  return (
    <StateContext.Provider value={{state, dispatch}}>
      {props.children}
    </StateContext.Provider>
  )
}

export default StateContextProvider;