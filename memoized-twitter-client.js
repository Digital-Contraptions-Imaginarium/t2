// ************************************************************************* //
// This is a memoized and rate-limited Twitter API client                    //
// ************************************************************************* //

const
    crypto = require('crypto'),
    // https://github.com/jprichardson/node-fs-extra
    // MIT license
    fs = require("fs-extra"),
    path = require("path"),
    RateLimiter = require("./rate-limiter").RateLimiter,
    // https://github.com/substack/json-stable-stringify
    // MIT license
    stringify = require('json-stable-stringify'),
    // https://github.com/desmondmorris/node-twitter
    // MIT license
    NodeTwitter = require('twitter'),
    // http://underscorejs.org/
    // custom license, MIT-derived?
    _ = require('underscore');

const
    APPLICATION = {
        LOCAL: "im.dico.twitter2rss",
        NAME: "twitter2rss",
        VERSION: "0.9.1"
    };

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

var Twitter = function (options) {

    options = options ? options : { };

    // check the Twitter credentials
    options.consumerkey = options.consumerkey ? options.consumerkey : process.env.TWITTER2RSS_CONSUMER_KEY;
    options.consumersecret = options.consumersecret ? options.consumersecret : process.env.TWITTER2RSS_CONSUMER_SECRET;
    options.tokenkey = options.tokenkey ? options.tokenkey : process.env.TWITTER2RSS_ACCESS_TOKEN_KEY;
    options.tokensecret = options.tokensecret ? options.tokensecret : process.env.TWITTER2RSS_ACCESS_TOKEN_SECRET;
    if(_.any([
        options.consumerkey,
        options.consumersecret,
        options.tokenkey,
        options.tokensecret
    ], x => (!_.isString(x) || (x === "")))) {
        throw(new Error("The Twitter credentials are not specified either in the environment or the command line."));
        process.exit(1);
    }

    // create the Twitter client
    var twitterClient = new NodeTwitter({
        "consumer_key": options.consumerkey,
        "consumer_secret": options.consumersecret,
        "access_token_key": options.tokenkey,
        "access_token_secret": options.tokensecret
    });

    // check the folders required for functioning
    options.local = options.local ? options.local : path.join(process.env.HOME, ".local", APPLICATION.LOCAL);
    const
        CACHE_FOLDER = path.join(options.local, "cache"),
        LIMITERS_FOLDER = path.join(options.local, "limiters");

    // create the folders used for memoization and rate limiting, if it does not
    // exist already
    try {
        // TODO: this is suitable to recent Fedora distros, but what about other OS's?
        fs.ensureDirSync(CACHE_FOLDER);
        fs.ensureDirSync(LIMITERS_FOLDER);
    } catch (e) {
        console.error(new Error("Error creating the application folders."));
        process.exit(1);
    }

    var
        rateLimiter15Per15Minutes = new RateLimiter("limiter-15-per-15minutes", 15, 900000, { "local": LIMITERS_FOLDER }),
        rateLimiter75Per15Minutes = new RateLimiter("limiter-75-per-15minutes", 75, 900000, { "local": LIMITERS_FOLDER }),
        rateLimiter450Per15Minutes = new RateLimiter("limiter-450-per-15minutes", 450, 900000, { "local": LIMITERS_FOLDER }),
        rateLimiter900Per15Minutes = new RateLimiter("limiter-900-per-15minutes", 900, 900000, { "local": LIMITERS_FOLDER });

    // TODO: some garbage collection

    var getLatestCacheTimestamp = (prefixHashForMemoization, callback) => {
        fs.readdir(CACHE_FOLDER, (err, files) => {
            if (err) {
                console.error("Error reading the cache folder: " + err.message);
                return process.exit(1);
            }
            callback(null, _.last(files
                .filter(filename => filename.match(new RegExp('^' + prefixHashForMemoization)))
                .map(filename => hashString2date(filename.match(/_(\d{11})$/)[1]))
                .sort()));
        });
    }

    var loadCache = (prefixHashForMemoization, timestamp, callback) => {
        fs.readFile(path.join(CACHE_FOLDER, prefixHashForMemoization + date2HashString(timestamp)), { "encoding": "utf8" }, (err, text) => {
            if (err) {
                console.error("Failed reading from cache, with error message: " + err.message);
                return process.exit(1);
            }
            callback(null, JSON.parse(text));
        });
    }

    var saveCache = (prefixHashForMemoization, timestamp, content, callback) => {
        fs.writeFile(path.join(CACHE_FOLDER, prefixHashForMemoization + date2HashString(timestamp)), JSON.stringify(content), { "encoding": "utf8" }, err => {
            if (err) {
                console.error("Error writing the cache file: " + err.message);
                return process.exit(1);
            }
            callback(null);
        });
    }

    // supported APIs
    const API_CONFIGURATIONS = [
        // see https://dev.twitter.com/rest/public/rate-limits ; in the following:
        // - "endpoint" is the official Twitter API endpoint,
        // - "buffer" is the no. of milliseconds the results of calling the APIs
        //   will be cached, e.g. the API won't be called again unless at latest
        //   18000 milliseconds have elapsed
        // - "limiting" is a rate-limiter object that implements the API's
        //   respective rate limit as specified in the web page above
        // Each configuration generates two functions: a non memoized wrapper to
        // the Twitter API, that is not exported by the library, and a memoized
        // one, that is.
        { "endpoint": "lists/list.json", "buffer": 900000, "limiting": rateLimiter15Per15Minutes },
        { "endpoint": "lists/members.json", "buffer": 900000, "limiting": rateLimiter75Per15Minutes },
        { "endpoint": "lists/statuses.json", "buffer": 900000, "limiting": rateLimiter900Per15Minutes },
        { "endpoint": "search/tweets.json", "buffer": 900000, "limiting": rateLimiter450Per15Minutes },
    ];

    var forExporting = { };
    API_CONFIGURATIONS.forEach(apiconf => {

        var functionName = apiconf.endpoint.match(/(^.+)\/(.+)\.json/);
        functionName = "get" +
            functionName[1].substring(0, 1).toUpperCase() + functionName[1].substring(1, functionName[1].length) +
            functionName[2].substring(0, 1).toUpperCase() + functionName[2].substring(1, functionName[2].length);

        var nonMemoizedFunction = (parameters, callback) => {
            if (!callback) { callback = parameters; parameters = { }; }
            apiconf.limiting.removeTokens(1, (err) => {
                twitterClient.get(
                    apiconf.endpoint,
                    parameters,
                    function (err, results, response) {
                        if (err) {
                            console.error("Failed querying Twitter API for metadata about all lists, with error message: " + err.message);
                            return process.exit(1);
                        }
                        callback(null, results);
                    }
                );
            });
        };

        forExporting[functionName] = (parameters, callback) => {
            if (!callback) { callback = parameters; parameters = { }; }
            const BUFFER = apiconf.buffer;
            var timestamp = new Date(),
                prefixHashForMemoization = crypto.createHash('sha1');
            prefixHashForMemoization =
                functionName +
                "_" +
                prefixHashForMemoization.update(stringify({
                    "application": APPLICATION,
                    "twitter_options": options,
                    "parameters": parameters
                })).digest('hex') +
                "_";
            getLatestCacheTimestamp(prefixHashForMemoization, (err, latestCacheTimestamp) => {
                if (timestamp - latestCacheTimestamp <= BUFFER) {
                    loadCache(prefixHashForMemoization, latestCacheTimestamp, callback);
                } else {
                    nonMemoizedFunction(parameters, (err, results)=> {
                        saveCache(prefixHashForMemoization, timestamp, results, err => {
                            callback(null, results);
                        });
                    });
                }
            });
        }

    });
    return forExporting;

}

exports.Twitter = Twitter;
