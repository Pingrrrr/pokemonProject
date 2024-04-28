const express = require("express");
//const cookieParser = require('cookie-parser');
//const sessions = require('express-session');

var app = express();
const path = require('path');
const PORT = 3000;

const halfDay = 1000 * 60 * 60 * 12;

/*app.use(sessions({
    secret: "thisisVERYsecretVERYshush2",
    saveUninitialized: true,
    cookie: { maxAge: halfDay },
    resave: false 
}));*/


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
//app.use(express.urlencoded({ extended: true }));
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

app.get("/cards", async (req, res) => {
    let lastQuery = req.query;
    let typeSQL = await db.promise().query(`SELECT * FROM type`);
    let types = typeSQL[0];

    let stageSQL = await db.promise().query(`SELECT DISTINCT stage FROM card WHERE stage<>''`);
    let stages = stageSQL[0];

    let raritySQL = await db.promise().query(`SELECT DISTINCT rarity FROM card WHERE rarity<>''`);
    let rarities = raritySQL[0];

    let categorySQL = await db.promise().query(`SELECT DISTINCT category FROM card WHERE category<>''`);
    let categories = categorySQL[0];

    let cardsQuery = `SELECT card.*  FROM card `;
    let joins = [];
    let wheres = [];

    const type = req.query.type;
    const type_join = `INNER JOIN card_type ON card.card_id=card_type.card_id INNER JOIN type ON card_type.type_id=type.type_id`;
    const type_where = `type.name IN ('${[].concat(type).join(`','`)}')`;

    const stage = req.query.stage;
    const stage_where = `card.stage IN ('${[].concat(stage).join(`','`)}')`;

    const rarity = req.query.rarity;
    const rarity_where = `card.rarity IN ('${[].concat(rarity).join(`','`)}')`;

    const category = req.query.category;
    const category_where = `card.category IN ('${[].concat(category).join(`','`)}')`;

    const weakness = req.query.weakness;
    const weakness_join = `INNER JOIN weakness ON card.card_id=weakness.card_id`;
    const weakness_where = `weakness.type_id IN (SELECT type.type_id FROM type WHERE name IN ('${[].concat(weakness).join(`','`)}'))`;

    const resistance = req.query.resistance;
    const resistance_join = `INNER JOIN resistance ON card.card_id=resistance.card_id`;
    const resistance_where = `resistance.type_id IN (SELECT type.type_id FROM type WHERE name IN ('${[].concat(resistance).join(`','`)}'))`;

    if(type!=null && type!='None'){
        joins.push(type_join);
        wheres.push(type_where);        
    }

    if(stage!=null){
        wheres.push(stage_where);
    }

    if(rarity!=null){
        wheres.push(rarity_where);
    }

    if(category!=null){
        wheres.push(category_where);
    }

    if(weakness!=null){
        joins.push(weakness_join);
        wheres.push(weakness_where);
    }

    if(resistance!=null){
        joins.push(resistance_join);
        wheres.push(resistance_where);
    }

    cardsQuery += joins.join(' ');
    if(wheres.length>0){
        cardsQuery+=" WHERE "+wheres.join(' AND ');
    }
    console.log(cardsQuery);
    console.log(lastQuery.type);
    
    db.query(cardsQuery, (err, dataset) => {
        if (err) throw err;
        res.render('cards', { cards: dataset, types: types, stages: stages, rarities:rarities, categories:categories, lastQuery:lastQuery });
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

