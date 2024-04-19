const express = require("express");

var app = express();
const path = require('path');
const PORT = 3000;

const mysql  = require('mysql2');
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',         
    password: '',         // MAMP is 'root'
    database: 'tradecard',   // the name of your database
    port: '3306'          // MAMP  port might be '8889'
});


db.connect((err)=> {
    if(err) throw err;
    console.log('database connected successfully');
});



let read = "SELECT * FROM card";
db.query(read,(err, result)=>{
    if(err) throw err;
    console.table(result);
});



app.use(express.static('static'));
app.set("view engine", "ejs");

app.get("/", function (req, res) {
    res.send("<h2>My Express Web App </h2>")
});

app.get("/home", function (req, res) {
    res.sendFile(path.join(__dirname, '/static', 'tradecard.html'))
});

app.get("/cards", function (req, res) {
    let cardsQuery = `SELECT card_id, name  FROM card`;
    db.query(cardsQuery, (err, dataset)=>{ 
      if(err) throw err;
      res.render('cards', {dataset});
})
});

//ONE CARD
app.get('/card', (req, res) => {
    const card_id = req.query.id;
    const readcard = `SELECT * FROM card WHERE card_id = ${card_id} `;
    db.query(readcard, (err, dataset)=>{ 
        if(err) throw err;
        let card = dataset[0];
        console.log(card);
        res.render('card', {card});
  })
 });

app.get("/landing", function (req, res){
    const readcard = `SELECT * FROM card LIMIT 6`;
    db.query(readcard, (err, dataset)=>{
        res.render("tradecard", {dataset});
    })
    
});

app.get('*', (req, res) => {
    res.send("404! Whoops, I cannot find that!");
});

app.listen(PORT, () => console.log("Listening on port 3000!"));

