const express = require("express");

var app = express();
const path = require('path');
const PORT = 3000;

const mysql = require('mysql2');
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'tradecard',
    port: '3306'
});

db.connect((err) => {
    if (err) throw err;
    console.log('database connected successfully');
});

app.use(express.static('static'));
app.set("view engine", "ejs");

app.get("/", function (req, res) {
    const readcard = `SELECT * FROM card LIMIT 12`;
    db.query(readcard, (err, dataset) => {
        res.render("tradecard", { dataset });
    })

});

app.get('/login', (req, res) => {
    res.render("login");
});

app.get('/signup', (req, res) => {
    res.render("signup");
});

app.get("/cards", function (req, res) {
    let cardsQuery = `SELECT *  FROM card`;
    db.query(cardsQuery, (err, dataset) => {
        if (err) throw err;
        res.render('cards', { dataset });
    })
});

//ONE CARD
app.get('/card', (req, res) => {
    const card_id = req.query.id;
    const readcard = `SELECT * FROM card WHERE card_id = ${card_id} `;
    db.query(readcard, (err, dataset) => {
        if (err) throw err;
        let card = dataset[0];
        const cardattack = `  SELECT attack.* FROM card
	INNER JOIN card_attack ON card_attack.card_id = card.card_id
    INNER JOIN attack ON card_attack.attack_id = attack.attack_id
WHERE card.card_id = ${card_id}`;
        db.query(cardattack, (err, attacks) => {
            if (err) throw err;
            card.attacks=attacks;
            console.log(card);
            res.render('card', { card });
        });



    })
});

app.get('*', (req, res) => {
    res.send("404! Whoops, I cannot find that!");
});

app.listen(PORT, () => console.log("Listening on port 3000!"));

