class Project {
    pid;
    isActive = false;
    config;

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
    constructor(pid, isActive, config) {
        this.pid = pid;
        this.isActive = isActive
        this.config = config;
        this.seeder();
        setInterval(()=>{
            if(this.isActive) {
                sendMessage({
                    pid:this.pid,
                    isActive: this.isActive,
                    jobs: this.jobs
                });
            }
        }, 100);
    }

    setActive(isActive) {
        this.isActive = isActive;
    }

    setConfig(conf) {
        this.config = conf;
    }

    worker(item) {
        return new Promise((resolve, reject) => {
            //change status;
            item.status = 10;
            fetch(item.path)
                .then(response => {
                    item.status = 40;
                    if(response.ok) {
                        response.text().then(content => {
                            //ok we have data. first write it to db
                            let data = {
                                id: item.pageID,
                                pid: this.pid,
                                time: Date.now(),
                                path: item.path,
                                content: content
                            };

                            let request = db.transaction(["Pages"], "readwrite").objectStore("Pages").put(data);
                            request.onsuccess = (event) => {
                                //change status
                                item.status = 50;
                                //now extract <a>, <script>, <link>, <img> links
                                const regexp = /(?:(?:<a|<link).* href=[\'"]?([^\'" >]+))|(?:(?:<img|<script).* src=[\'"]?([^\'" >]+))/gi;
                                const matches = content.matchAll(regexp);
                                //console.log(matches);
                                let counter = 50/matches.length;
                                for (const match of matches) {
                                    let txtUrl = match[1]? match[1]:match[2];
                                    try {

                                        let url = new URL(txtUrl, item.path);
                                        txtUrl = url.toString().substring(0,url.toString().length-url.hash.length);
                                        //console.log(url);
                                        if(this.config.whiteList.indexOf(url.host) >= 0) {
                                            let newUrl = {
                                                pid: this.pid,
                                                time: 0,
                                                path: txtUrl
                                            };
                                            //console.log(newUrl);
                                            db.transaction(["Pages"], "readwrite").objectStore("Pages").add(newUrl);
                                            item.status += counter;
                                        }
                                    } catch (e) {}
                                }
                                item.status = 100;
                                //
                            };
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

        this.worker(this.jobs[threadIndex]).finally(()=>{
            let i = 0;
            for(i = 0; i<this.jobs.length; i++) {
                if(this.jobs[i].pageID == pageID) {
                    this.jobs.splice(i, 1);//delete finished job
                    break;
                }
            }
            //this.jobs.splice(threadIndex, 1);//delete finished job
        });
    }

    deleteJob(){}

    async seeder() {
        //for now if this.pid is set to 0 then project has been deleted and must be stopped
        while(this.pid) {
            console.log("Project " + this.pid + " jobs:" + this.jobs.length);

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
