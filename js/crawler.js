//after connecting to database. every 3 seconds we will refresh projects
initDB(() => {setInterval(initProjects, 3000);});

//the key of Projects array is pid of the projects, then we could easyly access every project in this list by accessing Projects[pid]
var Projects = {};

function initProjects() {
  let dbProjects = db.transaction("Projects").objectStore("Projects");

  dbProjects.getAll().onsuccess = function(event) {
    //console.log(event.target.result);

    //get pid of previously defined projects.
    var outDatedKeys = Object.keys(Projects);
    //update projects and also add new ones
    event.target.result.forEach((item, i) => {
        //so Projects[item.pid] is available yet. then remove from outdated projects
        const index = outDatedKeys.indexOf(item.pid.toString());
        if (index > -1) {
          outDatedKeys.splice(index, 1);
        }

        if(!(item.pid in Projects)) {
            //create project
            Projects[item.pid] = new Project(item.pid, item.active, item.config);
        }
        else {
            //update project
            Projects[item.pid].setActive(item.active);
            Projects[item.pid].setConfig(item.config);
        }
    });
    //remove deleted projects
    outDatedKeys.forEach((item, i) => {
        //i dont know how exactly delete the object so seeder got stop
        Projects[item].pid = 0;
        delete Projects[item];
    });
  };
}
