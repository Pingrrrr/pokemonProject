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
app.get('/card', async (req, res) => {
    const card_id = req.query.id;
    const readcard = `SELECT * FROM card WHERE card_id = ${card_id} `;
    let cardSQL = await db.promise().query(readcard);
    let card = cardSQL[0][0];

    const readtype = `SELECT * FROM card_type INNER JOIN type ON card_type.type_id=type.type_id WHERE card_type.card_id=${card_id} `;
    let typeSQL = await db.promise().query(readtype);
    let types = typeSQL[0];
    card.types=types;

    const cardattack = `  SELECT attack.* FROM card
	INNER JOIN card_attack ON card_attack.card_id = card.card_id
    INNER JOIN attack ON card_attack.attack_id = attack.attack_id
WHERE card.card_id = ${card_id}`;
    let attackSQL = await db.promise().query(cardattack);
    let attacks = attackSQL[0];
    card.attacks=attacks;

    const cardabilties = `  SELECT ability.* FROM card
	INNER JOIN card_ability ON card_ability.card_id = card.card_id
    INNER JOIN ability ON card_ability.ability_id = ability.ability_id
WHERE card.card_id = ${card_id}`;
    let abilitySQL = await db.promise().query(cardabilties);
    let abilities = abilitySQL[0];
    card.abilities=abilities;

    const cardresist = ` SELECT * FROM resistance INNER JOIN type ON resistance.type_id = type.type_id WHERE resistance.card_id = ${card_id}`;
    let resistanceSQL = await db.promise().query(cardresist);
    let cardresistances = resistanceSQL[0];
    card.resistances=cardresistances;
    

    const cardweakness = ` SELECT * FROM weakness INNER JOIN type ON weakness.type_id = type.type_id WHERE weakness.card_id  = ${card_id}`;
    let weaknessSQL = await db.promise().query(cardweakness);
    let cardweaknesses = weaknessSQL[0];
    card.weaknesses=cardweaknesses;
    


    console.log(card);
    res.render('card', { card });

});

app.get('*', (req, res) => {
    res.send("404! Whoops, I cannot find that!");
});

app.listen(PORT, () => console.log("Listening on port 3000!"));

