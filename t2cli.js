// ************************************************************************* //
// This is a command-line wrapper for the memoized-twitter-client.js library //
// ************************************************************************* //

const
    async = require("async"),
    // https://github.com/jprichardson/node-fs-extra
    // MIT license
    fs = require("fs-extra"),
    T2 = require("./t2").Twitter,
    // http://underscorejs.org/
    // custom license, MIT-derived?
    _ = require('underscore');

const
    APPLICATION = {
        LOCAL: "im.dico.t2cli",
        NAME: "t2cli",
        VERSION: "0.1.0"
    };

var
    // https://github.com/yargs/yargs
    // MIT/X11 license
    argv = require('yargs')
        .usage('Usage: $0 <command> [options]')
        .demandCommand(1, "You must specify a <command>.")
        .epilog(APPLICATION.NAME + " v" + APPLICATION.VERSION + "\nThis software is copyright (C) 2017 Digital Contraptions Imaginarium Ltd. 2017 and released under the MIT Licence (MIT).")
        .argv;

var fileExistsSync = f => {
    // TODO if the original from the *fs* library was deprecated there must be a reason...
    var ok = true; try { fs.statSync(f); } catch (err) { ok = false; }; return ok;
}

var twitter = new T2({
    "consumerkey": argv.consumerkey | process.env.TWITTER2RSS_CONSUMER_KEY,
    "consumersecret": argv.consumersecret | process.env.TWITTER2RSS_CONSUMER_SECRET,
    "tokenkey": argv.tokenkey | process.env.TWITTER2RSS_ACCESS_TOKEN_KEY,
    "tokensecret": argv.tokensecret | process.env.TWITTER2RSS_ACCESS_TOKEN_SECRET
});

// TODO: this code is duplicated in t2.js, too, you can do better
var functionName = argv._[0].match(/^(.+)\/(.+)$/);
functionName = "get" +
    functionName[1].substring(0, 1).toUpperCase() + functionName[1].substring(1, functionName[1].length) +
    functionName[2].substring(0, 1).toUpperCase() + functionName[2].substring(1, functionName[2].length);

// drop from Yargs' argv any element that must not be handed over to the actual Twitter API
var twitterParameters = JSON.parse(JSON.stringify(argv));
_.keys(twitterParameters)
    .filter(key => _.any([ "^_$", "^\\$", "^post$", "^consumerkey$", "^consumersecret$", "^tokenkey$", "^tokensecret$" ], re => key.match(new RegExp(re))))
    .forEach(key => { delete twitterParameters[key]; });
// call my memoized wrapper, print the results to stdout and exit
twitter[functionName](twitterParameters, (err, results) => {
    if (err) {
        console.error("Failed with error message: " + err.message);
        process.exit(1);
    }
    async.reduce(!argv.post ? [ "x => JSON.stringify(x)" ] : [ ].concat(argv.post), results, (memo, p, callback) => {
        p = eval(fileExistsSync(p) ? fs.readFileSync(p, { "encoding": "utf8" }) : p);
        if (p.length > 1) {
            // the --post function is asynchronous
            return p(memo, callback);
        } else {
            // the --post function is synchronous
            callback(null, p(memo));
        }
    }, (err, results) => {
        if (err) {
            console.error("Undefined error in executing the --post commands.");
            process.exit(1);
        }
        console.log(results);
    });
});
