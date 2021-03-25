"use strict";
//Exported functions:
//  animateIcon()

const animationPeriod = 1000;
let lastAnimationInvoke;
function isAnimationTimeElapsed() {
    return lastAnimationInvoke<(Date.now()-animationPeriod);
}

function animateIcon() {
    if(isAnimationTimeElapsed())
        setAnimatedIcon();
    lastAnimationInvoke = Date.now();
}
function freezeIcon() {
    if(isAnimationTimeElapsed())
        setStaticIcon();
}

setInterval(freezeIcon, animationPeriod);

function setAnimatedIcon() {
    browser.browserAction.setIcon({
        path: {
            16: "style/grabber-16.gif",
            32: "style/grabber-32.gif"
        }
    });
}

function setStaticIcon() {
    browser.browserAction.setIcon({path:"style/grabber.svg"});
}
