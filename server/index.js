require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const express_enforces_ssl = require('express-enforces-ssl');
const helmet = require('helmet');

let articleTitles = [];
let formattedResponse = {};
let latestIndex = 0;
const articleNumber = 15;

let app = express();

if (process.env.NODE_ENV !== 'local') {
	app.use(helmet());
	app.enable('trust proxy');
	app.use(express_enforces_ssl());
	app.use(function(req, res, next) {
		res.header("Access-Control-Allow-Origin", "*.ft.com");
		res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
		next();
	});
} else {
	app.use(express.static(path.resolve(__dirname + "/../public")));

	app.get('/', function(req, res){
		res.sendFile(path.resolve(__dirname +'/../index.html'));
	});	
}

app.get('/titles', function(req,res){
	res.json(formattedResponse);
});

function formatTitles() {
	let answerObject = {};
	let content = [];

	for(i in articleTitles) {
		let title = articleTitles[i].title.split(' ');

		for(let j = 0; j < title.length; ++j) {
			let item = {
				word: title[j],
				link: articleTitles[i].link
			};
			content.push(item);
		}
	}

	answerObject.content = content;
	answerObject.total = content.length;

	return answerObject;
}


function apiCall(){
	let queryParams = {
		"queryString": "",
		"queryContext" : {          
		    "curations" : [ "ARTICLES", "BLOGS" ]
		},      
		"resultContext" : {          
		    "maxResults" : articleNumber,          
		    "offset" : "0",
		    "aspects" : [ "title", "location", "summary", "lifecycle", "metadata"],
		    "sortOrder": "DESC",          
		    "sortField": "lastPublishDateTime"
		}
	};

	let options = {
		host: process.env.CAPI_HOST,
		path: process.env.CAPI_ENDPOINT + '?apiKey=' + process.env.CAPI_KEY,
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Content-Length': JSON.stringify(queryParams).length
		}
	};

	let hreq = https.request(options);

	hreq.on('response', function (hres) {
	    hres.setEncoding('utf8');

	    let response = '';

	    hres.on('data', function (chunk) {
	    	response += chunk;
	    });

	    hres.on('end', function(res) {
	    	let results = JSON.parse(response).results[0].results;
	    	let latest = JSON.parse(response).results[0].indexCount;

	    	if (latest > latestIndex) {
	    		latestIndex = latest;
	    		articleTitles = [];

	    		for(let i = 0; i < results.length; ++i) {
	    			let item = {
	    				title: results[i].title.title + '.',
	    				link: results[i].location.uri
	    			};

	    			articleTitles.push(item);	
	    		}

	    		formattedResponse = formatTitles();
	    	}
	    });

	    hres.on('error', function (e) {
	        console.log('ERROR: ' + e.message);
	    }); 
	});

	hreq.write(JSON.stringify(queryParams));
	
	hreq.end();
}

setInterval(apiCall, 1000);

app.listen(process.env.PORT || 2017);