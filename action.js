const port = chrome.runtime.connect({ name: "popup" });
port.onMessage.addListener((msg) => {
    if (msg.type === "UPDATE_POPUP") {
        document.getElementById("content").textContent = msg.data;
    }
});
