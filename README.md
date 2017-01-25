twitter2rss
===========

Note: this GitHub branch is dedicated to *t2*: a major overhaul of the original *twitter2rss* project that - over time - has grown into something that was too complex for my liking and contrary to my principles for simple and frugal solutions. In this README you find the new documentation only, the old is available at the [*master*](https://github.com/Digital-Contraptions-Imaginarium/twitter2rss) branch.

t2
==

*t2* is a Node.js module and command line client for Twitter. It owes its name to [sferik/t](https://github.com/sferik/t): another command line client for Twitter that I aim at replacing in my projects at some point. Differently than other Twitter libraries for Node.js, *t2* was written to be smart about rate limiting and data use in general, support for which are built in.

At the moment of writing, *t2* only supports APIs that "read" content (the "GET" ones).

## t2cli

*t2cli* is *t2*'s command line tool. In order to keep it as simple as possible, it mimics the syntax of the APIs it wraps, rather than having its own commands and options. The general usage in fact is:

```
$ node t2cli.js <twitter_api_name> [twitter_option] [twitter_option] ... [t2_option] [t2_option] ...
```

where:
- ```twitter_api_name``` is the Twitter API name as you see them listed at [https://dev.twitter.com/rest/public/rate-limits](https://dev.twitter.com/rest/public/rate-limits), e.g. ```lists/list```;
- ```twitter_option``` is one of the options the specified API supports, e.g. ```--user_id giacecco```, and
- ```t2_option``` is one of the *t2* specific options, e.g. ```consumerkey```, ```consumerkey```, ```consumersecret``` and ```tokenkey``` for the credentials to use to connect to the Twitter servers.

When not specified on the command line, both *t2cli* and the *t2* library attempt reading the credentials from the user environment in the variables ```TWITTER2RSS_CONSUMER_KEY```, ```TWITTER2RSS_CONSUMER_SECRET```, ```TWITTER2RSS_ACCESS_TOKEN_KEY``` and ```TWITTER2RSS_ACCESS_TOKEN_SECRET```.

The ```--post``` *t2* option can be used to run one or more transformations over the API results, before displaying, expressed as a JavaScript function. E.g. a very useful transformation is ```--post 'r => r.map(x => JSON.stringify(x)).join("\n")' ``` that makes one JSON array of objects - as in the results of the original ```lists/list``` API - into [JSONL](http://jsonlines.org/): one JSON object per line.

In the example below, for example, we fetch the lists that belong to user [@dicoim](https://twitter.com/dicoim), pick the third list only, and transform the output from JSON to JSONL.

```
$ node t2cli.js lists/list --user_id dicoim --post 'r => [ r[2] ]' --post 'r => r.map(x => JSON.stringify(x)).join("\n")'
{"id":756036774724571100,"id_str":"756036774724571136","name":"next economy","uri":"/dicoim/lists/next-economy","subscriber_count":0,"member_count":26,"mode":"public","description":"See https://github.com/Digital-Contraptions-Imaginarium/newsbeuter-configuration","slug":"next-economy","full_name":"@dicoim/next-economy","created_at":"Thu Jul 21 08:03:08 +0000 2016","following":true,"user":{"id":14214993,"id_str":"14214993","name":"DiCo.Im","screen_name":"dicoim","location":"London, UK","description":"We are Digital Contraptions Imaginarium: a small and independent tech consultancy firm in London, UK, that brings tech, people and data together.","url":"https://t.co/V0ymu49mBn","entities":{"url":{"urls":[{"url":"https://t.co/V0ymu49mBn","expanded_url":"https://dico.im","display_url":"dico.im","indices":[0,23]}]},"description":{"urls":[]}},"protected":false,"followers_count":869,"friends_count":1320,"listed_count":180,"created_at":"Tue Mar 25 12:26:56 +0000 2008","favourites_count":2409,"utc_offset":0,"time_zone":"London","geo_enabled":false,"verified":false,"statuses_count":1851,"lang":"en","contributors_enabled":false,"is_translator":false,"is_translation_enabled":false,"profile_background_color":"000000","profile_background_image_url":"http://abs.twimg.com/images/themes/theme1/bg.png","profile_background_image_url_https":"https://abs.twimg.com/images/themes/theme1/bg.png","profile_background_tile":false,"profile_image_url":"http://pbs.twimg.com/profile_images/756014052225212417/VtssPRWk_normal.jpg","profile_image_url_https":"https://pbs.twimg.com/profile_images/756014052225212417/VtssPRWk_normal.jpg","profile_banner_url":"https://pbs.twimg.com/profile_banners/14214993/1469083399","profile_link_color":"DB5A3D","profile_sidebar_border_color":"000000","profile_sidebar_fill_color":"000000","profile_text_color":"000000","profile_use_background_image":false,"has_extended_profile":false,"default_profile":false,"default_profile_image":false,"following":false,"follow_request_sent":false,"notifications":false,"translator_type":"none"}}
$
```

In this other example we search for the most recent tweets with the word "trump" in them, drop all the metadata and display just the text:

```
$ node t2cli.js search/tweets --result_type recent --q trump --post 'r => JSON.stringify(r.statuses.map(s => s.text))'
["RT @metesohtaoglu: #ABD Başkanı Trump,Kızılderililerin tepki gösterdiği #Dakota Boru Hattı inşaasına onay verdi\n#DakotaKızılderilileriYalnı…","RT @parool: Arjen Lubach: 'Satirische programma's zijn naast de zonen van Trump de enigen die baat hebben bij zijn aantreden' https://t.co/…","RT @SocialPowerOne1: Lindsey Graham Tells Trump To Put Up Or Shut Up On 'Illegal' Votes https://t.co/Y6v3KB7Chx","RT @cliffiroanya: @RepRibble #Biafrans celebrating President Trump massacred by Nigerian soldiers, see picture and ABC News: https://t.co/W…","RT @ChriStylezz: Can y'all please look at Melania face when Trump turns around 😭😭😭 https://t.co/UkpOnRS7S5","RT @MightyBusterBro: CROWD SIZE IS NEWS\nBECAUSE CNN LIES\nMADE IT NEWS.\n1Min Streamlined Report adapted from InfoWars\n\n#FakeNews #POTUS #Ina…","No longer will your taxpayer money be paying for Planned Parenthood to perform... https://t.co/OxNoQReqyi by #elohimis1 via @c0nvey","RT @ABC: Bernie Sanders: \"The great political and democratic crisis we face...is not voter fraud, it is voter suppression\" https://t.co/eZU…","RT @TheDemocrats: Trump can't silence the fact that climate change is real. https://t.co/vaTTImzjRG","RT @ananavarro: I hoped some seasoned operatives around Trump would stop him from making crap up. Help him act sane. Instead, he's making t…","RT @AmyMek: America's President! \n\nTraditionally Democrats, Unions across USA praise President Trump on the Keystone XL, Dakota Access pipe…","@Endoracrat @BFahrland This is what I find troubling Hillary really did win but instead of the Democrats fighting for her they let trump in","Day four of Trump and he's already fucking up. #NoDAPL \nThis is not what the people want! #IStandWithStandingRock","RT @a_meluzzi: Orban: “Con Trump finisce il multilateralismo, bisogna ritornare all’Europa delle nazioni” - La Stampa https://t.co/8R7aYICG…","@nut_bunnies SICK BURN! NO I'M LITERALLY BURNING BECAUSE TRUMP DESTROYED THE ECOSYSTEM AND OH GOD MY SKIN'S MELTING"]
$
```

Note that, to do a good job, you often need to know the exact format of the response you get from the native Twitter API, e.g. in the second example all the results are found in an array named *statuses*. This is also why *t2* is useful, as caching and rate limiting allow you to repeat the same request with different ```--post``` arguments without the need to fetch the live data again every time or worrying of breaking the limits on the API usage.
