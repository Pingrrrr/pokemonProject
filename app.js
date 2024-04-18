const express = require("express");

var app = express();
const path = require('path');
const PORT = 3000;

app.use(express.static('static'));
app.set("view engine", "ejs");

app.get("/", function (req, res) {
    res.send("<h2>My Express Web App </h2>")
});

app.get("/home", function (req, res) {
    res.sendFile(path.join(__dirname, '/static', 'tradecard.html'))
});

app.get("/landing", function (req, res){
    res.render("tradecard");
});

app.get('*', (req, res) => {
    res.send("404! Whoops, I cannot find that!");
});

app.listen(PORT, () => console.log("Listening on port 3000!"));

