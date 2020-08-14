const reducer = (state, action) => {
  const {type, payload} = action;
  let newState;
  switch (type) {
    case "ADD_TAB":
      newState = {
        ...state,
        tabs: [...state.tabs, {title: "new", text: ""}],
        activeTab: state.tabs.length
      }
      window.localStorage.setItem("saveState", JSON.stringify(newState));
      return newState;

    case "DELETE_TAB":
      newState = {
        ...state,
        tabs: state.tabs.filter((_, idx) => idx !== payload.tabIdx),
        activeTab: payload.activeTab
      }
      window.localStorage.setItem("saveState", JSON.stringify(newState));
      return newState;

    case "CHANGE_TAB":
      newState = {
        ...state,
        activeTab: payload.tabIdx
      }
      window.localStorage.setItem("saveState", JSON.stringify(newState));
      return newState;

    case "UPDATE":
      newState = {
        ...state,
        tabs: state.tabs.map((tab, idx) => {
          if (idx !== payload.tabIdx) return tab
          return {
            ...tab,
            text: payload.text || tab.text,
            title: payload.title || tab.title
          }
        })
      }
      window.localStorage.setItem("saveState", JSON.stringify(newState));
      return newState;
    default:
      return state;
  }
}

export default reducer;