class Project {
    pid;
    name;
    isActive = false;
    config;
    intervalID;
    enabled = true;
    /*
        jobs array
        [
            {
                pageID: number,
                path:string
                status: 0-100 <0: not started, 40: content downloaded, 50: content saved, 50-100: saving links>
            }
        ]
    */
    jobs = [];
    constructor(pid, name, isActive, config) {
        this.pid = pid;
        this.name = name;
        this.isActive = isActive
        this.config = config;
        this.seeder();
        this.intervalID = setInterval(()=>{
            sendMessage("siteGrabberMain", {
                type:"Pages",
                pid:this.pid,
                jobs: this.jobs
            });
        }, 200);
    }

    destructor() {
        this.enabled = false;
        clearInterval(this.intervalID);
    }

    setActive(isActive) {
        this.isActive = isActive;
    }

    setConfig(conf) {
        this.config = conf;
    }

    /*
        1. get link Content
        2. save content to db
        3. if it is a html file, extract links
        4. save links
    */
    worker(item) {
        return new Promise((resolve, reject) => {
            //change status;
            item.status = 10;
            fetch(item.path).then(response => {
                item.status = 40;
                if(response.ok) {
                    response.blob().then(content => {
                        //ok we have data. first write it to db
                        let data = {
                            id: item.pageID,
                            pid: this.pid,
                            time: Date.now(),
                            path: item.path,
                            content: content
                        };
                        let request = db.transaction(["Pages"], "readwrite").objectStore("Pages").put(data);

                        // if it is text/html then extract links
                        if(response.headers.get('Content-Type').substr(0, 9) == "text/html") {
                            //change status
                            item.status = 50;
                            //now extract all available links
                            content.text().then((txt)=>{
                                const matches = getLinks(txt);
                                var counter = 50/matches.length;
                                let progress = 50;
                                matches.forEach((match) => {
                                    progress += counter;
                                    item.status = Math.round(progress);
                                    try {
                                        let url = new URL(match, item.path);
                                        let txtUrl = url.protocol + "//" + url.host + url.pathname;
                                        if(this.config.whiteList.indexOf(url.host) >= 0) {
                                            let newUrl = {
                                                pid: this.pid,
                                                time: 0,
                                                path: txtUrl
                                            };
                                            //console.log(newUrl);
                                            db.transaction(["Pages"], "readwrite").objectStore("Pages").add(newUrl);
                                        }
                                    } catch (e) {}
                                });
                            });
                        }
                        resolve();
                    });
                } else {
                    let data = {
                        id: item.pageID,
                        pid: this.pid,
                        time: Date.now(),
                        path: item.path,
                        content: ""
                    };

                    db.transaction(["Pages"], "readwrite").objectStore("Pages").put(data);
                    reject();
                }
            });
        });
    }

    addJob(pageID, path){
        let threadIndex = this.jobs.push({
            pageID : pageID,
            path: path,
            status : 0
        }) - 1;

        this.worker(this.jobs[threadIndex]).finally(()=>{this.deleteJob(pageID)});
    }

    async deleteJob(pageID){
        await new Promise(r => setTimeout(r, 500));
        let i = 0;
        for(i = 0; i<this.jobs.length; i++) {
            if(this.jobs[i].pageID == pageID) {
                this.jobs.splice(i, 1);//delete finished job
                break;
            }
        }
    }

    async seeder() {
        //for now if this.pid is set to 0 then project has been deleted and must be stopped
        while(this.enabled) {
            //console.log("Project " + this.pid + " jobs:" + this.jobs.length);

            let doWait = false;
            if(!this.isActive || this.jobs.length >= this.config.downloadLimit) {
                doWait = true;
            } else {
                //get pages where are for this project and are elder than the age specified for update(lifetime)
                let Pages = db.transaction("Pages", "readonly").objectStore("Pages");
                let lifeTime = Date.now() - this.config.lifeTime *24*60*60*1000;
                var range = IDBKeyRange.bound([this.pid, 0],[this.pid, lifeTime]);
                let cursorIsOpen = true; //emulating synchronize function
                var rq = Pages.index("pageDated").openCursor(range);

                rq.onsuccess = (event) => {
                    let cursor = event.target.result;
                    if(cursor == null) {
                        //console.log("No other url on pid(" + this.pid + ") is available!");
                        doWait = true;
                        cursorIsOpen = false;
                        return;
                    }
                    let node = cursor.value;
                    //console.log(node);
                    //first search in jobs if already fetching the url we will ignore this one
                    if(this.jobs.some((item)=>{return item.pageID == node.id;})) {
                        //console.log("url is found in list!");
                        cursor.continue();
                        return;
                    }
                    doAnimate();
                    this.addJob(node.id, node.path);

                    //ok let do some speedy. if we have some space in jobs, use current db connection and fill them...
                    if(this.jobs.length < this.config.downloadLimit) {
                        cursor.continue();
                        return;
                    }
                    cursorIsOpen = false;
                };

                while(cursorIsOpen){await new Promise(r => setTimeout(r, 50));}
            }

            if(doWait) {
                await new Promise(r => setTimeout(r, 500));
            }
        }
    }
}

/****** Regular Expression functions ******/

let regexps = [
    /(?:(?:<a|<link).* href=[\'"]?([^\'" >]+))/gi,      //gets <a href & <link href links
    /(?:(?:<img|<script).* src=[\'"]?([^\'" >]+))/gi    //gets <img src & <script src links
];

function getLinks(content) {
    var result = [];
    regexps.forEach((regexp) => {
        matches = content.matchAll(regexp);
        for (const match of matches) {
            result.push(match[1]);
        }
    });
    return result;
}

function replaceLinks(content, replacer) {
    regexps.forEach((regexp) => {
        content = content.replace(regexp, replacer);
    });
    return content;
}
