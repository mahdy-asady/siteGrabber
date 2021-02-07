if (!window.indexedDB) {
    console.log("Your browser doesn't support a stable version of IndexedDB. Such and such feature will not be available.");
}

//main database to store projects
var db_projects;
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
  //projectStore.createIndex("name", "name", { unique: false });
  //projectStore.createIndex("active", "active", { unique: false });

  /*
    Pages store:
        * id        **key
        * pid
        * time
        * path
        * content

  */
  let pagesStore = db.createObjectStore("Pages", { keyPath: "id", autoIncrement: true });
  projectStore.createIndex("pageDated", ["pid", "time"], { unique: false });
  //projectStore.createIndex("active", "active", { unique: false });

};

request.onsuccess = function(event) {
  console.log("db.success!");
  db_projects = event.target.result;
  initProjects();
};


function initProjects() {
  var objectStore = db_projects.transaction("Projects").objectStore("Projects");

  objectStore.getAll().onsuccess = function(event) {
    console.log("Got all Projects: ");
    console.log(event.target.result);
  };
}
