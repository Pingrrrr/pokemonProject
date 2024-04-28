console.log("starting the scraper");

const https = require('https');
const mysql = require('mysql2');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',         // MAMP is 'root'
    database: 'tradecard',   // the name of your database
    port: '3306'          // MAMP  port might be '8889'
});


db.connect((err) => {
    if (err) throw err;
    console.log('database connected successfully');
});

const typeMap = new Map();
typeMap.set('Colorless', 1);
typeMap.set('Darkness', 2);
typeMap.set('Dragon', 3);
typeMap.set('Fairy', 4);
typeMap.set('Fighting', 5);
typeMap.set('Fire', 6);
typeMap.set('Grass', 7);
typeMap.set('Lightning', 8);
typeMap.set('Metal', 9);
typeMap.set('Psychic', 10);
typeMap.set('Water', 11);



let set = "base3";
let setID = 3;
let setUrlBase = "https://api.tcgdex.net/v2/en/sets/";
let cardUrlBase = "https://api.tcgdex.net/v2/en/cards/";

let setUrl = setUrlBase + set;
var cardIds = [];

https.get(setUrl, (res) => {
    let body = "";

    res.on("data", (chunk) => {
        body += chunk;
    });

    res.on("end", () => {
        try {
            let json = JSON.parse(body);

            for (let i = 0; i < json.cards.length; i++) {
                //console.log(json.cards[i].id);

                //update the expansion 

                //update the set



                getCards(json.cards[i].id);
            }
            // do something with JSON
        } catch (error) {
            console.error(error.message);
        };
    });

}).on("error", (error) => {
    console.error(error.message);
});

//console.log(cardIds.length);
function getCards(cardId) {
    let cardUrl = cardUrlBase + cardId;
    https.get(cardUrl, (res) => {
        let body = "";

        res.on("data", (chunk) => {
            body += chunk;
        });

        res.on("end", () => {
            try {
                let json = JSON.parse(body);
                console.log(json.id + " : "+ json.name);


                //update the item if it exists
                let itemID = null;
                if ('item' in json) {
                    db.query(`INSERT into item (name, effect) VALUES(?,?)`,
                    [json.item.name, json.item.effect], (err, result) => {
                        if (err) throw err;
                        console.log("item created: " + result.insertId);
                        itemID = result.insertId;
                    });

                };


                //update the card
                let cardID = null;
                dexID = null;
                if ('dexId' in json){
                    dexID = json.dexId[0];
                }
                db.query(`INSERT into card (set_id, name, hp, retreat_cost, rarity, image_url, description, illustrator, category, pokedex_id, evolved_from, level, stage, item_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                    [setID, json.name, json.hp, 0, json.rarity, json.image, json.description, json.illustrator, json.category, dexID, json.evolveFrom, json.level, json.stage, itemID], (err, result) => {
                        if (err) throw err;
                        console.log("card created: " + result.insertId);
                        cardID = result.insertId;

                        //add types
                        if ('types' in json) {
                        for (let i = 0; i < json.types.length; i++) {
                            let typeID = typeMap.get(json.types[i]);
                            db.query(`INSERT into card_type (card_id, type_id) VALUES(?,?)`,
                                [cardID, typeID], (err, result) => {
                                    if (err) throw err;
                                    //console.log("card_type created: " + result.insertId);
                                });

                        }
                    }

                        //weakness, resistance
                        if ('weaknesses' in json) {
                            for (let i = 0; i < json.weaknesses.length; i++) {
                                let typeID = typeMap.get(json.weaknesses[i].type);
                                db.query(`INSERT into weakness (card_id, type_id, severity) VALUES(?,?,?)`,
                                    [cardID, typeID, json.weaknesses[i].value], (err, result) => {
                                        if (err) throw err;
                                        //console.log("weakness created: " + result.insertId);
                                    });
    
                            }
                        };

                        if ('resistances' in json) {
                            for (let i = 0; i < json.resistances.length; i++) {
                                let typeID = typeMap.get(json.resistances[i].type);
                                db.query(`INSERT into resistance (card_id, type_id,severity) VALUES(?,?,?)`,
                                    [cardID, typeID, json.resistances[i].value], (err, result) => {
                                        if (err) throw err;
                                        //console.log("resistance created: " + result.insertId);
                                    });
    
                            }

                        };


                        //add ability
                        if ('abilities' in json) {
                            for (let i = 0; i < json.abilities.length; i++) {
                                let abilityID = null;
                                db.query(`INSERT into ability (name, description) VALUES(?,?)`,
                                    [json.abilities[i].name, json.abilities[i].effect], (err, result) => {
                                        if (err) throw err;
                                        //console.log("ability created: " + result.insertId);
                                        abilityID = result.insertId;
    
                                        db.query(`INSERT into card_ability (card_id, ability_id) VALUES(?,?)`,
                                            [cardID, abilityID], (err, result) => {
                                                if (err) throw err;
                                                //console.log("card_ability created: " + result.insertId);
                                            });
                                    });
    
    
                            }

                        };


                    });

                //add attack and cost
                if ('attacks' in json) {
                    for (let i = 0; i < json.attacks.length; i++) {
                        let attackID = null;
                        db.query(`INSERT into attack (name, description, damage) VALUES(?,?,?)`,
                            [json.attacks[i].name, json.attacks[i].effect, json.attacks[i].damage], (err, result) => {
                                if (err) throw err;
                                //console.log("attack created: " + result.insertId);
                                attackID = result.insertId;
    
                                db.query(`INSERT into card_attack (card_id, attack_id) VALUES(?,?)`,
                                    [cardID, attackID], (err, result) => {
                                        if (err) throw err;
                                        //console.log("card_attack created: " + result.insertId);
                                    });
    
                                let costMap = new Map();
                                for (let ii = 0; ii < json.attacks[i].cost.length; ii++) {
                                    let v = costMap.get(json.attacks[i].cost[ii]);
                                    if(v==null){
                                        v = 0;
                                    }
    
                                    costMap.set(json.attacks[i].cost[ii],++v );
                                    let typeID = typeMap.get(json.attacks[i].cost[ii]);
    
    
                                }
    
                                costMap.forEach((value, key) => {
                                    //console.log("cost type:"+key);
                                    let typeID = typeMap.get(key);
                                    db.query(`INSERT into cost (attack_id, type_id, cost) VALUES(?,?,?)`,
                                    [attackID, typeID, value], (err, result) => {
                                        if (err) throw err;
                                        //console.log("cost created: " + result.insertId);
                                    });
                                    
                                });
                            });
    
    
    
                    }

                };
                

            } catch (error) {
                console.error(error.message);
            };
        });

    }).on("error", (error) => {
        console.error(error.message);
    });

};

