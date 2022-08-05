import React from "react";
import ClickOutside from "./ClickOutside";

function Modal({ children, closeModal }) {
  return (
    <>
      <div className="modal-overlay" />
      <ClickOutside onClickOutside={closeModal}>
        <div className="modal-container">{children}</div>
      </ClickOutside>
    </>
  );
}

export default Modal;
