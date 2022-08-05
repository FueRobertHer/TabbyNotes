/**
 * https://github.com/tj/react-click-outside
 */

import React from "react";

class ClickOutside extends React.Component {
  constructor(props) {
    super(props);
    this.getContainer = this.getContainer.bind(this);
    this.isTouch = false;
  }

  componentDidMount() {
    document.addEventListener("touchend", this.handle, true);
    document.addEventListener("click", this.handle, true);
    document.addEventListener("keydown", this.handle, true);
  }

  componentWillUnmount() {
    document.removeEventListener("touchend", this.handle, true);
    document.removeEventListener("click", this.handle, true);
    document.removeEventListener("keydown", this.handle, true);
  }

  render() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { children, onClickOutside, containerToIgnore, ...props } =
      this.props;
    return (
      <div className="click-outside" {...props} ref={this.getContainer}>
        {children}
      </div>
    );
  }

  getContainer(ref) {
    this.container = ref;
  }

  handle = (e) => {
    const { onClickOutside, containerToIgnore, isActive = true } = this.props;

    // Don't trigger anything if it isn't active
    if (!isActive) return;

    // Don't trigger on a touch
    if (e.type === "touchend") this.isTouch = true;
    if (e.type === "click" && this.isTouch) return;

    // Trigger if it's an escape keypress
    if (e.type === "keydown" && e.key === "Escape") {
      onClickOutside(e);
      return;
    }

    // Don't trigger if the click is inside containerToIgnore
    if (
      containerToIgnore &&
      containerToIgnore.current &&
      containerToIgnore.current.contains(e.target)
    ) {
      return;
    }

    // Trigger if click outside!
    const el = this.container;
    if (!el.contains(e.target)) onClickOutside(e);
  };
}

export default ClickOutside;