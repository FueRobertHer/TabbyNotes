// Saves options to chrome.storage
function save_options() {
  const backgroundColor = document.getElementById(
    "option-background-color"
  ).value;
  const height = document.getElementById("option-height").value;
  const width = document.getElementById("option-width").value;

  chrome.storage.sync.set(
    {
      backgroundColor,
      height,
      width,
    },
    () => {
      // Update status to let user know options were saved.
      const status = document.getElementById("status");
      status.textContent = "Options saved.";
      setTimeout(() => (status.textContent = ""), 750);
    }
  );
}

// Restores state using the preferences stored in chrome.storage.
function restore_options() {
  chrome.storage.sync.get(
    {
      backgroundColor: "red",
      height: "80vh",
      width: "30vw",
    },
    (items) => {
      document.getElementById("option-background-color").value =
        items.backgroundColor;
      document.getElementById("option-height").value = items.height;
      document.getElementById("option-width").value = items.width;

      document.getElementById("tabby-notes").style = {
        backgroundColor: items.backgroundColor,
      };
      window.getElementById("App").style = {
        height: items.height,
        width: items.width,
      };
    }
  );
}
document.addEventListener("DOMContentLoaded", restore_options);
document.getElementById("save").addEventListener("click", save_options);
