
//set toolbar icon an action
browser.browserAction.onClicked.addListener((tab) => {
  // requires the "tabs" or "activeTab" permission
  openManager();
});



async function openManager() {
    let url = browser.runtime.getURL("windows/default.html");

    const etabs = await browser.tabs.query({url});

    if (etabs.length) {
        const tab = etabs.pop();
        await browser.tabs.update(tab.id, { active: true });
        await browser.windows.update(tab.windowId, { focused: true });
        return;
    }

    await browser.tabs.create({
        active: true,
        url
    });

    await browser.windows.update(window.id, { focused: true });
}
