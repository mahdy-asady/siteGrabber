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
  let objectStore = db.createObjectStore("Projects", { keyPath: "name" });
  objectStore.createIndex("active", "active", { unique: false });

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
