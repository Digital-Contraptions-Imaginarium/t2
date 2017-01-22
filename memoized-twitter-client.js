// ************************************************************************* //
// This is intended to be a command-line, memoized and rate-limited Twitter  //
// API client                                                                //
// ************************************************************************* //

var
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

    var rateLimiter15PerMinute = new RateLimiter("limiter-15-per-minute", 15, "minute", { "local": LIMITERS_FOLDER });

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

    var retrieveCache = (prefixHashForMemoization, timestamp, callback) => {
        fs.readFile(path.join(CACHE_FOLDER, prefixHashForMemoization + date2HashString(timestamp)), (err, text) => {
            if (err) {
                console.error("Failed reading from cache, with error message: " + err.message);
                return process.exit(1);
            }
            callback(null, JSON.parse(text));
        });
    }

    this.getLists = (callback, results) => {

        var timestamp = new Date(),
            prefixHashForMemoization = crypto.createHash('sha1');
        prefixHashForMemoization =
            "getLists" +
            "_" +
            prefixHashForMemoization.update(stringify({
                "application": APPLICATION,
                "twitter_options": options,
            })).digest('hex') +
            "_";

        const BUFFER = 18000; // in no case the request will be made more often than every 5 minutes
        getLatestCacheTimestamp(prefixHashForMemoization, (err, latestCacheTimestamp) => {
            if (timestamp - latestCacheTimestamp <= BUFFER) {
                // the cache is still valid
                console.log("READING FROM THE CACHE");
                retrieveCache(prefixHashForMemoization, latestCacheTimestamp, callback);
            } else {
                rateLimiter15PerMinute.removeTokens(1, (err) => {
                    console.log("FETCHING LIVE");
                    twitterClient.get(
                        "lists/list.json",
                        { }, // any params?
                        function (err, lists, response) {
                            if (err) {
                                console.error("Failed querying Twitter API for metadata about all lists, with error message: " + err.message);
                                return process.exit(1);
                            }
                            fs.writeFile(path.join(CACHE_FOLDER, prefixHashForMemoization + date2HashString(timestamp)), JSON.stringify(response.body), err => {
                                if (err) {
                                    console.error("Error writing the cache file: " + err.message);
                                    return process.exit(1);
                                }
                                callback(null, response);
                            });
                        }
                    );
                });
            }
        });
    };

}

exports.Twitter = Twitter;
