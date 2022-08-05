import React from "react";
import Modal from "./Modal";
import useActions from "./useActions";
import useSelectedState from "./useSelectedState";

function ConfirmDeleteModal() {
  const { confirmDelete, getDeleteTabTitle, deleteIdx } = useSelectedState();
  const { toggleConfirmDelete, deleteOrResetTab } = useActions();
  const deleteTabTitle = getDeleteTabTitle();

  if (!confirmDelete) return null;

  return (
    <Modal closeModal={() => toggleConfirmDelete()}>
      <div className="confirm-delete">
        <p>
          Delete the "<b>{deleteTabTitle}</b>" tab?
        </p>
        <div className="cancel-confirm-wrapper">
          <button onClick={() => toggleConfirmDelete()}>Cancel</button>
          <button onClick={() => deleteOrResetTab(deleteIdx)}>Confirm</button>
        </div>
      </div>
    </Modal>
  );
}

export default ConfirmDeleteModal;
