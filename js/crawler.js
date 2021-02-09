initDB(initProjects);


function initProjects() {
  var objectStore = db.transaction("Projects").objectStore("Projects");

  objectStore.getAll().onsuccess = function(event) {
    console.log("Got all Projects: ");
    console.log(event.target.result);
  };
}
