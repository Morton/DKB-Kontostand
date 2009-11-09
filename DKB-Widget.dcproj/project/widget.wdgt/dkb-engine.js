function httpGet(url, obj, callback) {
    var xmlRequest = new XMLHttpRequest();
    xmlRequest.onload = function () {
        if (xmlRequest.status == 200) {
            callback(obj, xmlRequest.responseText);
        }
        else {
            alert("Error fetching data: HTTP status " + xmlRequest.status);
        }
    };
    xmlRequest.open("GET", url);
    xmlRequest.setRequestHeader("Cache-Control", "no-cache");
    xmlRequest.send();
}
function httpPost(url, params, cookie, obj, callback) {
    var xmlRequest = new XMLHttpRequest();
    xmlRequest.onload = function () {
        if (xmlRequest.status == 200) {
            callback(obj, xmlRequest.responseText);
        }
        else {
            alert("Error fetching data: HTTP status " + xmlRequest.status);
        }
    };
    xmlRequest.open("POST", url);
    xmlRequest.setRequestHeader("Cache-Control", "no-cache");
    xmlRequest.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    xmlRequest.setRequestHeader("Content-length", params.length);
    xmlRequest.setRequestHeader("Cookie", cookie);
    xmlRequest.setRequestHeader("Connection", "close");
    xmlRequest.send(params);
}

function DKBEngine(user, pwd, finalCallback, errorCallback) {
    this.password = pwd;
    this.username = user;
    this.data = null;
    this.loggedOut = false;
    this.parsed = false;
    this.showError = true;
    this.error = errorCallback;
    this.final = finalCallback;
    
    this.fetchLoginUrl = function () {
        console.log('1: fetchLoginUrl');
        httpGet("https://banking.dkb.de/dkb/-", this, this.parseLoginUrl);
    }
    this.parseLoginUrl = function (self, code) {
        var reg = /content='0; URL=(.*?)'/;
        var matches = reg.exec(code);
        self.loginUrl = RegExp.$1;
        
        // extract jsession
        reg = /jsessionid=(.*?)\?/;
        matches = reg.exec(self.loginUrl);
        self.jsession = RegExp.$1;
                
        self.fetchToken();
    }

    this.fetchToken = function () {
        console.log('2: fetchToken');
        httpGet(this.loginUrl, this, this.parseToken);
    }
    this.parseToken = function (self, code) {
        var reg = /name="token" value="(.*?)"/;
        var matches = reg.exec(code);
        self.token = RegExp.$1;
        self.doLogin();
    }

    this.doLogin = function () {
        console.log('3: doLogin');
        var params = "%24%24event_login.x=0&%24%24event_login.y=0&token=" + this.token + "&j_username=" + this.username + "&j_password=" + this.password + "&%24part=Welcome.login&%24%24%24event_login=login";
        httpPost("https://banking.dkb.de/dkb/-",  params, "JSESSIONID=" + this.jsession, this, this.parseSite);
    }
    this.parseSite = function (self, code) {
        self.doLogout();
        
        code = code.replace(/\n/g, '');
        var parseReg = /<tr class="(?:even)?(?:odd)?-row">.*?<td.*?accountNo">\s*(.*?)\s*<\/td>.*?<td.*?name">\s*(.*?)<br\/>.*?<td.*?saldo.>.*?<span.*?>(.*?) (.*?)<\/span>.*?<\/tr>/gm;
        if (!code.match(parseReg)) {
            console.error("Bitte Logindaten prüfen.");
            self.error("Bitte Logindaten prüfen.");
            self.showError = false;
        } else {
            console.log("logged in");
                
            self.data = new Array();
            while ((match = parseReg.exec(code)) != null) {
                var line = new Array(RegExp.$1, RegExp.$2, RegExp.$3, RegExp.$4);
                self.data.push(line);

                alert(line[0] + " " + line[1] + " " + line[2] + " " + line[3]);
            }
            
            self.parsed = true;
            self.finalize();
        }
    }
     
    this.doLogout = function () {
        console.log('4: doLogout');
        httpPost('https://banking.dkb.de/dkb/-', '$$event_logout.x=56&$$event_logout.y=18&$part=DkbTransactionBanking.login-status', 'JSESSIONID=' + this.jsession, this, this.validateLogout);
    }
    this.validateLogout = function (self, code) {
        var goodReg = /.*?content='0; URL=https:\/\/banking\.dkb\.de\/dkb\/\-\?\$part=Welcome\.logout&\$javascript=disabled'.*/;
        if (!code.match(goodReg)) {
            console.error('Fehler beim Ausloggen!');
            if (self.showError) {
                self.error('Fehler beim Ausloggen!');
            }
        } else {
            console.log("logged out");
            
            self.loggedOut = true;
            self.finalize();
        }
    }

    this.finalize = function () {
        console.log('5: finalize');
        if (this.parsed && this.loggedOut) {
            this.final(this.data);
        }
    }
    
    // code
    this.fetchLoginUrl();
}