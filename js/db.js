"use strict";

//Global Database variable
var db;

//*************************************************************

function initiateDatabase() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject("IndexedDB Not Supported by Browser!");
        }

        let request = window.indexedDB.open("__DATA__", 1);
        request.onerror = databaseErrorHandler(reject);
        request.onupgradeneeded = databaseUpgradeHandler;
        request.onsuccess = databaseSuccessHandler(resolve);
    });
}

//*************************************************************

function databaseSuccessHandler(resolve) {
    return function(event) {
        db = event.target.result;
        resolve();
    }
}

//*************************************************************

function databaseErrorHandler(reject) {
    return function(event) {
        reject("Database error: " + event.target.errorCode);
    }
};

//*************************************************************

function databaseUpgradeHandler(event) {
    let db = event.target.result;
    /*
    Project store:
        * pid        **key
        * isActive
        * name
        * config
            * whiteList
            * downloadLimit
            * maxSize
            * lifeTime
    */
    let projectStore = db.createObjectStore("Projects", { keyPath: "pid", autoIncrement: true });

    /*
    Pages store:
        * id        **key
        * pid
        * time
        * path
        * content

    */
    let pagesStore = db.createObjectStore("Pages", { keyPath: "id", autoIncrement: true });
    //pid index, usefull for searching all pages for specific project, used in deleting pages and export
    pagesStore.createIndex("pid", "pid", { unique: false });
    //pageDated index, usefull for searching outdated pages
    pagesStore.createIndex("pageDated", ["pid", "time"], { unique: false });
    //pathOfProject index, this index just is to create a unique rule on pages preventing saving a page twice in a project
    pagesStore.createIndex("pathOfProject", ["pid", "path"], { unique: true });

};
