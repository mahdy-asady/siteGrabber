class Project {
    pid;
    isActive = false;
    config;

    /*
        threads array
        [
            {
                pageID: number,
                path:string
                status: <0: not started, 1: getting content, 2: getting links, 3: finished>
            }
        ]
    */
    threads = [];
    constructor(pid, isActive, config) {
        this.pid = pid;
        this.isActive = isActive
        this.config = config;
        this.seeder();
    }

    setActive(isActive) {
        this.isActive = isActive;
    }

    setConfig(conf) {
        this.config = conf;
    }

    soldier(item) {
        return new Promise((resolve, reject) => {
            //change status;
            item.status = 1;
            fetch(item.path)
                .then(response => {
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
                                item.status = 2;
                                //now extract <a>, <script>, <link>, <img> links
                                const regexp = /(?:(?:<a|<link).* href=[\'"]?([^\'" >]+))|(?:(?:<img|<script).* src=[\'"]?([^\'" >]+))/gi;
                                const matches = content.matchAll(regexp);
                                //console.log(matches);
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
                                        }
                                    } catch (e) {}
                                }
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

    async seeder() {
        console.log(this.pid);
        while(this.pid) {
            console.log("Project " + this.pid + " threads:" + this.threads.length);
            let doWait = false;
            if(!this.isActive || this.threads.length >= this.config.downloadLimit) {
                doWait = true;
            } else {
                //console.log("Getting url of " + this.pid);
                let Pages = db.transaction("Pages", "readonly").objectStore("Pages");
                let lifeTime = Date.now() - this.config.lifeTime *24*60*60*1000;

                var range = IDBKeyRange.bound([this.pid, 0],[this.pid, lifeTime]);
                let cursorIsOpen = true; //emulating synchronize function
                var rq = Pages.index("pageDated").openCursor(range);

                rq.onsuccess = (event) => {
                    let cursor = event.target.result;
                    if(cursor == null) {
                        console.log("No other url on pid(" + this.pid + ") is available!");
                        doWait = true;
                        cursorIsOpen = false;
                        return;
                    }
                    let node = cursor.value;
                    //console.log(node);
                    //first search in threads if already fetching the url we will ignore this one
                    if(this.threads.some((item)=>{return item.pageID == node.id;})) {
                        console.log("url is found in list!");
                        cursor.continue();
                        return;
                    }
                    // else {
                    //add to threads
                    let threadIndex = this.threads.push({
                        pageID : node.id,
                        path: node.path,
                        status : 0
                    }) - 1;

                    cursorIsOpen = false;
                    this.soldier(this.threads[threadIndex]).finally(()=>{
                        this.threads.splice(threadIndex, 1);
                    });
                };

                while(cursorIsOpen){await new Promise(r => setTimeout(r, 500));}
            }

            if(doWait) {
                await new Promise(r => setTimeout(r, 2000));
            }
            //delete finished projects
        }
    }
}
