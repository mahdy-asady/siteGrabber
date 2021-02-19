//after connecting to database. every 3 seconds we will refresh projects
initDB(() => {});

//the key of Projects array is pid of the projects, then we could easyly access every project in this list by accessing Projects[pid]
var Projects = {};

//*************************************************************************

browser.runtime.onConnect.addListener(initConnection);
var CSConnection;

function initConnection(c) {
    CSConnection = c;

    CSConnection.onDisconnect.addListener(() => {CSConnection = null});

    CSConnection.onMessage.addListener(msg => {
        switch (msg.type) {
            case "getList":
                sendProjectsList();
                break;
            case "Delete":
                deleteProject(msg.pid);
                break;
            case "toggleActivate":
                toggleActivate(msg.pid);
                break;
            case "Export":
                doExport(msg.pid);
                break;
            default:

        }
    });
}

async function sendMessage(msg) {
    if(CSConnection)
        CSConnection.postMessage(msg);
}


function deleteProject(pid) {
    db.transaction("Projects", "readwrite").objectStore("Projects").delete(pid).onsuccess = function(event) {
        let index = db.transaction("Pages", "readwrite").objectStore("Pages").index("pid");
        let request = index.openCursor(IDBKeyRange.only(pid));

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

function toggleActivate(pid) {
    let dbProjects = db.transaction("Projects", "readwrite").objectStore("Projects");
    dbProjects.put({
        pid:    pid,
        active:!Projects[pid].isActive,
        name:   Projects[pid].name,
        config: Projects[pid].config,

    });
}


function sendProjectsList() {
    let dbProjects = db.transaction("Projects").objectStore("Projects");
    dbProjects.getAll().onsuccess = function(event) {
        let rpt = [];
        //get pid of previously defined projects.
        var outDatedKeys = Object.keys(Projects);
        //update projects and also add new ones
        event.target.result.forEach(item => {
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
        outDatedKeys.forEach(item => {
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


function doExport(activeProject){
    var request = db.transaction("Projects").objectStore("Projects").get(activeProject);

    request.onsuccess = function(event) {
        // Do something with the request.result!
        let pName = request.result.name;

        let index = db.transaction("Pages").objectStore("Pages").index("pid");
        //create jsZip
        let zip = new JSZip();
        //create a root folder based on project name and store all files in it
        let root = zip.folder(pName);

        index.openCursor(IDBKeyRange.only(activeProject)).onsuccess = function(event) {
            let cursor = event.target.result;
            if (cursor) {
                if(cursor.value.time) {//just save files that has been scanned at last 1.
                    let url = cursor.value.path;
                    //first remove protocol
                    url = url.slice(url.indexOf("://")+3);
                    // TODO: remove prohbited characters

                    console.log(url);
                    //adding files to zip
                    root.file(url, cursor.value.content);
                }
                cursor.continue();
            }
            else {
                //saving file
                zip.generateAsync({type:"blob"})
                    .then(function(content) {
                        sendMessage({
                            type:"Export",
                            name: pName + ".zip",
                            content: content
                        });
                    });
            }
        }
    }
}
