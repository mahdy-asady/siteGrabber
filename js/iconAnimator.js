"use strict";
//Exported functions:
//  animateIcon()

const animationPeriod = 1000;
let lastAnimationInvoke = 0;


setInterval(freezeIcon, animationPeriod);

//*************************************************************

function freezeIcon() {
    if(isAnimationTimeElapsed())
        setStaticIcon();
}

//*************************************************************

function animateIcon() {
    if(isAnimationTimeElapsed())
        setAnimatedIcon();
    lastAnimationInvoke = Date.now();
}

//*************************************************************

function isAnimationTimeElapsed() {
    return lastAnimationInvoke<(Date.now()-animationPeriod);
}

//*************************************************************

function setAnimatedIcon() {
    browser.browserAction.setIcon({
        path: {
            16: "style/grabber-16.gif",
            32: "style/grabber-32.gif"
        }
    });
}

//*************************************************************

function setStaticIcon() {
    browser.browserAction.setIcon({path:"style/grabber.svg"});
}
