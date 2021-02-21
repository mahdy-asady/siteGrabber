//after connecting to database. every 3 seconds we will refresh projects
initDB(initProjects);

//the key of Projects array is pid of the projects, then we could easyly access every project in this list by accessing Projects[pid]
var Projects = {}

//*************************************************************************

browser.runtime.onConnect.addListener(initConnection);
var CSConnections = {};

function initConnection(newConnection) {
    let name = newConnection.name
    CSConnections[name] = newConnection;

    CSConnections[name].onDisconnect.addListener((p) => {delete CSConnections[p.name]});

    CSConnections[name].onMessage.addListener(msg => {
        switch (msg.type) {
            case "list":
                listProjects();
                break;
            case "new":
                newProject(msg.data);
                break;
            case "Delete":
                deleteProject(msg.pid);
                break;
            case "toggleActivate":
                toggleActivate(msg.pid);
                break;
            case "Export":
                exportProject(msg.pid);
                break;
            default:

        }
    });
}

async function sendMessage(name, msg) {
    if(CSConnections[name])
        CSConnections[name].postMessage(msg);
}

//*************************************************************************

function initProjects() {
    let dbProjects = db.transaction("Projects").objectStore("Projects");
    dbProjects.getAll().onsuccess = function(event) {
        event.target.result.forEach(item => {
            //create project
            Projects[item.pid] = new Project(item.pid, item.name, item.active, item.config);
        });
    }
}


function newProject(data) {
    let firstLink = data.firstLink;
    delete data.firstLink;

    var transaction = db.transaction("Projects", "readwrite");
    var objectStore = transaction.objectStore("Projects");
    var request = objectStore.add(data);
    request.onsuccess = function(event) {
        let pid = event.target.result;
        //event.target.result
        let Page ={
            pid: pid,
            time: 0,
            path: firstLink
        };

        var pgTransaction = db.transaction("Pages", "readwrite");
        var Pages = pgTransaction.objectStore("Pages");
        var PagesRequest = Pages.add(Page);
        PagesRequest.onsuccess = function(event) {
            console.log(data);
            Projects[pid] = new Project(pid, data.name, data.active, data.config);
            sendMessage("siteGrabberNew", {
                type:"ok"
            });
        };
    };

}

function deleteProject(pid) {
    //stop project
    Projects[pid].destructor();
    //Projects[pid] = null;
    delete Projects[pid];
    //remove from db
    db.transaction("Projects", "readwrite").objectStore("Projects").delete(pid).onsuccess = (event) => {
        let index = db.transaction("Pages", "readwrite").objectStore("Pages").index("pid");
        let request = index.openCursor(IDBKeyRange.only(pid));
        request.onsuccess = function(event) {
            let cursor = event.target.result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            }
        }
    }
}
//we certainly need a cleanup function to run every startup to remove remaining rows in Pages store.
//function cleanup(){}

function toggleActivate(pid) {
    Projects[pid].setActive(!Projects[pid].isActive);

    let dbProjects = db.transaction("Projects", "readwrite").objectStore("Projects");
    dbProjects.put({
        pid:    pid,
        active: Projects[pid].isActive,
        name:   Projects[pid].name,
        config: Projects[pid].config,

    });
}


function listProjects() {
    let rpt = [];
    Object.keys(Projects).forEach(item => {
        rpt.push({
            pid: Projects[item].pid,
            isActive: Projects[item].isActive,
            name: Projects[item].name
        });
    });

    sendMessage("siteGrabberMain", {
        type:"Projects",
        projects: rpt
    });
}


function exportProject(activeProject){
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

                    //adding files to zip
                    root.file(url, cursor.value.content);
                }
                cursor.continue();
            }
            else {
                //saving file
                zip.generateAsync({
                    type: "blob",
                    comment: "Generated by siteGrabber"
                }, data=>{
                    sendMessage("siteGrabberMain", {
                        type:"ExportStatus",
                        status: data.percent,
                        currentFile: data.currentFile
                    });
                }).then(function(content) {
                    sendMessage("siteGrabberMain", {
                        type:"Export",
                        name: pName + ".zip",
                        content: content
                    });
                });
            }
        }
    }
}
