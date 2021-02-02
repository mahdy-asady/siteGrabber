
//set toolbar icon an action
/*browser.browserAction.onClicked.addListener((tab) => {
  // requires the "tabs" or "activeTab" permission
  openManager();
});*/



async function openManager() {
    let url = browser.runtime.getURL("/windows/default.html");
    const etabs = await browser.tabs.query({url});
    if (etabs.length) {
        const tab = etabs.pop();
        await browser.tabs.update(tab.id, { active: true });
        await browser.windows.update(tab.windowId, { focused: true });
        return;
    }
    console.log("openManager runed3!");
    await browser.tabs.create({
        active: true,
        url
    });
    console.log("openManager runed4!");
    await browser.windows.update(window.id, { focused: true });
}
