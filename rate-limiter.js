// ************************************************************************* //
// This is a partial clone of https://github.com/jhurliman/node-rate-limiter //
// using the file system to share the limiters across different,             //
// non-concurrent executions of one or more Node scripts. Note that          //
// incredible things could happen if you use this concurrently instead!!!    //
// :-D                                                                       //
// ************************************************************************* //

const
    async = require("async"),
    crypto = require("crypto"),
    fs = require("fs-extra"),
    path = require("path"),
    _ = require("underscore");

const
    APPLICATION_NAME = "im.dico.rate-limiter";

const date2HashString = d => d.toISOString().
    replace(/\..+$/, ''). // delete the dot and everything after
    replace(/[T\-:]/g, ''). // delete the 'T', hyphens and columns
    replace(/^.../, ''); // drops the first three characters of the year, not useful

const hashString2date = s => new Date(
        (new Date()).getFullYear().toString().replace(/.$/, '') + s.substring(0, 1),
        parseInt(s.substring(1, 3)) - 1,
        s.substring(3, 5),
        s.substring(5, 7),
        s.substring(7, 9),
        s.substring(9, 11)
    );

var RateLimiter = function (resourceName, occurrences, timeInterval, options) {

    var _this = this;

    _this.initializeMemory = callback => {
        // create an empty cache if it does not exist already
        fs.stat(path.join(_this.options.local, _this.resourceName), (err, stats) => {
            if (!err) return callback(null);
            fs.ensureDir(path.join(_this.options.local, _this.resourceName), callback);
        });
    }

    _this.readMemory = callback => {
        _this.initializeMemory(err => {
            fs.readdir(path.join(_this.options.local, _this.resourceName), (err, files) => {
                if (err) {
                    console.error("Could not access the limiter memory folder " + path.join(_this.options.local, _this.resourceName) + " with error message: " + err.message);
                    process.exit(1);
                }
                try {
                    files = files.map(filename => { return({
                        "filename": filename,
                        "timestamp": hashString2date(filename.split("_")[0])
                    }); });
                } catch (err) {
                    console.error("Error parsing the limiter memory folder " + path.join(_this.options.local, _this.resourceName) + " with error message: " + err.message);
                    process.exit(1);
                }
                // memory garbage collection
                let now = new Date();
                async.reduce(files, [ ], (memo, file, callback) => {
                    if (now - file.timestamp <= _this.timeInterval) return callback(null, memo.concat(file.timestamp));
                    fs.remove(path.join(_this.options.local, _this.resourceName, file.filename), err => {
                        if (err) {
                            console.error("Error garbage collecting the limiter memory folder " + path.join(_this.options.local, _this.resourceName) + " with error message: " + err.message);
                            process.exit(1);
                        }
                        callback(null, memo);
                    });
                }, (err, memory) => {
                    callback(null, memory.sort());
                });
            });
        });
    }

    _this.writeMemory = (timestamp, callback) => {
        _this.initializeMemory(err => {
            fs.writeFile(path.join(_this.options.local, _this.resourceName, date2HashString(timestamp) + "_" + crypto.randomBytes(4).toString('hex')), "", err => {
                if (err) {
                    console.error("Could not write to the rate-limiting memory folder with error message: " + err.message);
                    process.exit(1);
                }
                callback(null);
            });
        });
    }

    _this.removeTokensQueue = async.queue((task, callback) => {
        let now = new Date();
        let check = () => {
            _this.readMemory((err, memory) => {
                // check for minWait
                if ((_.last(memory) && (_this.options.minWait && (_this.options.minWait > 0))) ? (now - _.last(memory) < _this.options.minWait) : false) {
                    // I need to wait
                    setTimeout(check, _this.options.minWait - now + _.last(memory));
                // check for the actual rate
                } else if (_this.occurrences < memory.length + task.tokensNo) {
                    // I need to wait
                    setTimeout(check, now - memory[task.tokensNo - 1]);
                // it's a go!
                } else {
                    _this.writeMemory(now, err => {
                        callback(null, _this.occurrences - memory.length);
                    });
                }
            });
        };
        check();
    }, 1);

    _this.removeTokens = (tokensNo, callback) => {
        if (!callback) { callback = tokensNo; tokensNo = 1; }
        _this.removeTokensQueue.push({ "tokensNo": tokensNo }, callback);
    }

    _this.resourceName = resourceName;
    _this.occurrences = occurrences;
    switch(timeInterval) {
        case "second":
            _this.timeInterval = 1000;
            break;
        case "minute":
            _this.timeInterval = 60000;
            break;
        case "hour":
            _this.timeInterval = 3600000;
            break;
        case "day":
            _this.timeInterval = 86400000;
            break;
        default:
            _this.timeInterval = parseInt(timeInterval);
    }
    _this.options = options ? options : { };
    // TODO: this is suitable to Fedora systems only, what about other Linux distro or other OS's?
    _this.options.local = _this.options.local ? _this.options.local : path.join(process.env.HOME, ".local", APPLICATION_NAME);
    _this.options.minWait = _this.options.minWait ? _this.options.minWait : 0;
    // initialization of folder structure
    fs.ensureDirSync(_this.options.local);

};

exports.RateLimiter = RateLimiter;
