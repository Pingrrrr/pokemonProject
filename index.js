const express = require("express");

var app = express();
const path = require('path');
const PORT = 3000;

app.use(express.static('static'));

app.get("/", function (req, res) {
    res.send("<h2>My Express Web App </h2>")
});

app.get("/home", function (req, res) {
    res.sendFile(path.join(__dirname, '/static', 'tradecard.html'))
});

app.listen(PORT, () => console.log("Listening on port 3000!"));