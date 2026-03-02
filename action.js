/*const port = chrome.runtime.connect({ name: "popup" });
port.onMessage.addListener((msg) => {
    if (msg.type === "UPDATE_POPUP") {
        document.getElementById("content").textContent = msg.data;
    }
});*/
console.log("popup action");
function callback(request, sender, sendResponse) {
  console.log(sender.tab ?
      "From a content script:" + sender.tab.url :
      "From the extension");
  console.log("added lisgtener");
}

chrome.runtime.onMessage.addListener(callback);
