var port = 8080;
var staticSite = __dirname + '/public';
var express = require('express');
var app = express()
app.use('/', express.static(staticSite));
app.listen(port, function() { console.log('listening')});

