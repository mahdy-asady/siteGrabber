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
      //pid index, usefull for searching all pages for specific project, used in deleting pages and export
      pagesStore.createIndex("pid", "pid", { unique: false });
      //pageDated index, usefull for searching outdated pages
      pagesStore.createIndex("pageDated", ["pid", "time"], { unique: false });
      //pathOfProject index, this index just is to create a unique rule on pages preventing saving a page twice in a project
      pagesStore.createIndex("pathOfProject", ["pid", "path"], { unique: true });

    };

    request.onsuccess = function(event) {
      console.log("db.success!");
      db = event.target.result;
      startFunc();
    };
}
