if (!window.indexedDB) {
    console.log("Your browser doesn't support a stable version of IndexedDB. Such and such feature will not be available.");
}

//main database to store projects
var db;
function initDB(startFunc) {
    var request = window.indexedDB.open("__DATA__", 1);
    console.log("db.open()!");

    request.onerror = function(event) {
      console.log("Why didn't you allow my web app to use IndexedDB?!");
      console.error("Database error: " + event.target.errorCode);
    };

    request.onupgradeneeded = function(event) {
      let db = event.target.result;
      console.log("onupgradeneeded!");
      /*
        Project store:
            * pid        **key
            * active
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
      pagesStore.createIndex("pid", "pid", { unique: false });
      pagesStore.createIndex("pageDated", ["pid", "time"], { unique: false });
      pagesStore.createIndex("pathOfProject", ["pid", "path"], { unique: true });

    };

    request.onsuccess = function(event) {
      console.log("db.success!");
      db = event.target.result;
      startFunc();
    };
}
