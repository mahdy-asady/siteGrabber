//after connecting to database. every 3 seconds we will refresh projects
initDB(() => {setInterval(initProjects, 500);});
//the key of Projects array is pid of the projects, then we could easyly access every project in this list by accessing Projects[pid]
var Projects = {};


browser.runtime.onMessage.addListener(msg => {
    switch (msg.type) {
        case "Delete":
            deleteProject(msg);
            break;
        case "toggleActivate":
                toggleActivate(msg);
                break;
        default:

    }
});
function deleteProject(msg) {
    console.log("Deleting Project");

    db.transaction("Projects", "readwrite").objectStore("Projects").delete(msg.pid).onsuccess = function(event) {
        let index = db.transaction("Pages", "readwrite").objectStore("Pages").index("pid");
        let request = index.openKeyCursor(IDBKeyRange.only(msg.pid));

        request.onsuccess = function(event) {
            let cursor = event.target.result;

            if (cursor) {
                cursor.delete();
                cursor.continue();
            }
        };
    };
}
//we certainly need a cleanup function to run every startup to remove remaining rows in Pages store.
//function cleanup(){}

function toggleActivate(msg) {
    let dbProjects = db.transaction("Projects", "readwrite").objectStore("Projects");
    dbProjects.put({
        pid:    msg.pid,
        active:!Projects[msg.pid].isActive,
        name:   Projects[msg.pid].name,
        config: Projects[msg.pid].config,

    });
}


function initProjects() {
    let dbProjects = db.transaction("Projects").objectStore("Projects");
    dbProjects.getAll().onsuccess = function(event) {
        let rpt = [];
        //get pid of previously defined projects.
        var outDatedKeys = Object.keys(Projects);
        //update projects and also add new ones
        event.target.result.forEach((item, i) => {
            rpt.push({
                pid: item.pid,
                isActive: item.active,
                name: item.name
            });
            //so Projects[item.pid] is available yet. then remove from outdated projects
            const index = outDatedKeys.indexOf(item.pid.toString());
            if (index > -1) {
              outDatedKeys.splice(index, 1);
            }

            if(!(item.pid in Projects)) {
                //create project
                Projects[item.pid] = new Project(item.pid, item.name, item.active, item.config);
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

        sendMessage({
            type:"Projects",
            projects: rpt
        });
    };
}