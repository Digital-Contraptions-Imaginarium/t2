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
    // https://github.com/jhurliman/node-rate-limiter
    // MIT license
    RateLimiter = require("./rate-limiter").RateLimiter,
    // https://github.com/substack/json-stable-stringify
    // MIT license
    stringify = require('json-stable-stringify'),
    // https://github.com/desmondmorris/node-twitter
    // MIT license
    Twitter = require('twitter'),
    // http://underscorejs.org/
    // custom license, MIT-derived?
    _ = require('underscore');

const
    APPLICATION = {
        NAME: "twitter2rss",
        VERSION: "0.9.1"
    },
    CACHE_FOLDER = path.join(process.env.HOME, ".local", APPLICATION.NAME, "cache"),
    COMMANDS = [ "lists" ],
    DEFAULT_OPTIONS = {
        "consumerkey": { "default": process.env.TWITTER2RSS_CONSUMER_KEY },
        "consumersecret": { "default": process.env.TWITTER2RSS_CONSUMER_SECRET },
        "tokenkey": { "default": process.env.TWITTER2RSS_ACCESS_TOKEN_KEY },
        "tokensecret": { "default": process.env.TWITTER2RSS_ACCESS_TOKEN_SECRET }
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

var // https://github.com/yargs/yargs
    // MIT/X11 license
    argv = require('yargs')
        .usage('Usage: $0 <command> [options]')
        .default({
            "consumerkey": process.env.TWITTER2RSS_CONSUMER_KEY,
            "consumersecret": process.env.TWITTER2RSS_CONSUMER_SECRET,
            "tokenkey": process.env.TWITTER2RSS_ACCESS_TOKEN_KEY,
            "tokensecret": process.env.TWITTER2RSS_ACCESS_TOKEN_SECRET
        })
        .demandCommand(1, "You must specify a <command>, that is one of: " + COMMANDS.sort().join(", "))
        .check((argv, opts) => {
            // console.log("argv: " + JSON.stringify(argv));
            // console.log("opts: " + JSON.stringify(opts));
            // check the command is one of the possible ones
            if (!_.contains(COMMANDS, argv._[0])) { throw(new Error("<command> must be one of: " + COMMANDS.sort().join(", "))); return false; }
            return true;
        })
        .check((argv, opts) => {
            // check that all the twitter credentials are specified
            if(_.any([
                argv.consumerkey,
                argv.consumersecret,
                argv.tokenkey,
                argv.tokensecret
            ], x => (!_.isString(x) || (x === "")))) { throw(new Error("The Twitter credentials are not specified either in the environment or the command line.")); return false; }
            return true;
        })
        // NOTE: because of a bug in the .command directive, it is not used here, see
        // https://github.com/yargs/yargs/issues/762 ; I've stopped
        // implementing checks on the command line while waiting for a resolution to this.
        .epilog(APPLICATION.NAME + " v" + APPLICATION.VERSION + "\nThis software is copyright (C) 2017 Digital Contraptions Imaginarium Ltd. 2017 and released under the MIT Licence (MIT).")
        .argv;

var
    configuration = {
        // TODO: not all environment variables are relevant to memoization
        "application": APPLICATION,
        "command": argv._[0],
        "timestamp": new Date(),
        "arguments": argv,
    },
    rateLimiter15PerMinute = new RateLimiter("im.dico." + APPLICATION.NAME, 15, "minute"),
    prefixHashForMemoization = crypto.createHash('sha1');

// calculate the hash for memoization from some parts of the configuration
prefixHashForMemoization =
    configuration.command +
    "_" +
    prefixHashForMemoization.update(stringify(_.pick(configuration,
        "application", // so that different versions make different hashes
        "command",
        "environment",
        "arguments"
    ))).digest('hex') +
    "_";

// create the cache folder used for memoization, if it does not exist already
try {
    // TODO: this is suitable to recent Fedora distros, but what about other OS's?
    fs.ensureDirSync(CACHE_FOLDER);
} catch (e) {
    console.error(new Error("Error creating the memoization cache folder."));
    process.exit(1);
}

// TODO: some garbage collection

// create the Twitter client
var twitterClient = new Twitter({
    "consumer_key": argv.consumerkey,
    "consumer_secret": argv.consumersecret,
    "access_token_key": argv.tokenkey,
    "access_token_secret": argv.tokensecret
});

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

var getLists = (callback, results) => {
    const BUFFER = 18000; // in no case the request will be made more often than every 5 minutes
    getLatestCacheTimestamp(prefixHashForMemoization, (err, latestCacheTimestamp) => {
        if (configuration.timestamp - latestCacheTimestamp <= BUFFER) {
            // the cache is still valid
            retrieveCache(prefixHashForMemoization, latestCacheTimestamp, callback);
        } else {
            rateLimiter15PerMinute.removeTokens(1, (err) => {
                twitterClient.get(
                    "lists/list.json",
                    { }, // any params?
                    function (err, lists, response) {
                        if (err) {
                            console.error("Failed querying Twitter API for metadata about all lists, with error message: " + err.message);
                            return process.exit(1);
                        }
                        fs.writeFile(path.join(CACHE_FOLDER, prefixHashForMemoization + date2HashString(configuration.timestamp)), JSON.stringify(response.body), err => {
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

getLists((err, response) => {
    console.log(JSON.stringify(response));
});
