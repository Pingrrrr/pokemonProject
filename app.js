const express = require("express");
const flash = require('express-flash'); //https://www.npmjs.com/package/express-flash & https://stackoverflow.com/a/42341464
const sessions = require('express-session');
const bcrypt = require('bcrypt');
const url = require('url');
const path = require('path');
const { query, body, validationResult } = require('express-validator'); //https://express-validator.github.io/docs
const saltRounds = 10;


var app = express();
const PORT = 3000;


//session setup
const halfDay = 1000 * 60 * 60 * 12;
app.use(sessions({
    secret: "thisisVERYsecretVERYshush2",
    saveUninitialized: true,
    cookie: { maxAge: halfDay },
    resave: false
}));

//https://stackoverflow.com/a/37184041
//locals allows the session object to be used in any of the rendered ejs files
app.use(function (req, res, next) {
    res.locals.authen = req.session.authen;
    next();
});


//DB setup
const mysql = require('mysql2');
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: '40126072',
    port: '3306'
});

db.connect((err) => {
    if (err) throw err;
    console.log('database connected successfully');
});


//middleware setup
app.use(express.static('static'));
app.use(express.urlencoded({ extended: true }));
app.use(flash());
app.set("view engine", "ejs");


app.get("/", function (req, res) {
    const sessionobj = req.session;
    if (sessionobj.authen) {
        res.redirect('/dashboard');
    } else {
        const readcard = `SELECT * FROM card ORDER BY RAND() LIMIT 12 `;
        db.query(readcard, (err, dataset) => {
            res.render("tradecard", { dataset });
        })
    }
});

app.get('/login', (req, res) => {
    res.render("login", { errMsgs: [] });
});

const loginValidator = [
    body('username', 'Username cannot be empty').notEmpty().trim(),
    body('password', 'Password cannot be empty').notEmpty()
];
app.post('/login', loginValidator, async (req, res) => {

    let errMsgs = [];
    const result = validationResult(req);
    if (result.isEmpty()) {

        const username = req.body.username;
        const password = req.body.password;
        let sess_obj = req.session;

        const checkuser = `SELECT * FROM user WHERE user_name = ? `;

        db.query(checkuser, [username], async (err, rows) => {
            if (err) throw err;
            const numRows = rows.length;
            if (numRows > 0) {
                //check the password
                const comparison = await bcrypt.compare(password, rows[0].user_password);
                if (comparison) {
                    sess_obj.authen = rows[0].user_id;
                    sess_obj.username = username;
                    res.redirect('/dashboard');
                } else {
                    errMsgs.push('Incorrect password');
                    res.render("login", { errMsgs: errMsgs });

                }
            } else {
                errMsgs.push('Incorrect username');
                res.render("login", { errMsgs: errMsgs });

            }
        });

    } else {
        [].concat(result.errors).forEach((err) => {
            errMsgs.push(err.msg);
        });
        res.render("login", { errMsgs: errMsgs });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/dashboard', (req, res) => {
    const sessionobj = req.session;
    if (sessionobj.authen) {
        const collectionsSQL = `SELECT * FROM collection WHERE user_id = ?`;
        db.query(collectionsSQL, [sessionobj.authen], (err, dataset) => {
            res.render("dashboard", { collections: dataset, session: req.session });
        });

    } else {
        res.send("403: access denied");
    }
});

const collectionValidator = [
    body('collection', 'Collection name cannot be empty').notEmpty(),
    body('collection', 'Collection name must be between 1 and 50 characters').isLength({ min: 6, max: 50 })
];
app.post('/dashboard', collectionValidator, (req, res) => {
    let errMsgs = [];
    const result = validationResult(req);
    if (result.isEmpty()) {

    const sessionobj = req.session;
    const collection = req.body.collection;
    let insertSQLcollection = `INSERT into collection (user_id, collection_name, is_wishlist) VALUES (?,?,?)`;

    if (sessionobj.authen) {
        db.query(insertSQLcollection, [sessionobj.authen, collection, false], (err, dataset) => {
            if (err) throw err;
            res.redirect('/dashboard');
        });
    } else {
        res.send("403: access denied");
    }
}else{
    [].concat(result.errors).forEach((err)=>{
        errMsgs.push(err.msg);
    });
    req.flash('errMsgs', errMsgs);
    res.redirect('/dashboard');
}
});


app.get('/signup', (req, res) => {
    res.render("signup", {errMsgs:[]});
});

const signupValidator = [
    body('username', 'Username cannot be empty').notEmpty().trim(),
    body('username', 'Username must be between 1 and 20 characters long').isLength({ min: 1, max: 20 }),
    body('password', 'Password cannot be empty').notEmpty(),
    body('password', 'Password must be between 6 and 20 characters long').isLength({ min: 6, max: 20 })
];

app.post('/signup', signupValidator, async (req, res) => {
    let errMsgs = [];
    let success = false;

    const result = validationResult(req);
    if (result.isEmpty()) {

        const username = req.body.username;
        const password = req.body.password;
        const encryptedPassword = await bcrypt.hash(password, saltRounds);

        //check username
        let existingUser = await db.promise().query(`SELECT * FROM user WHERE user_name = ? `, [username]);
        if (existingUser[0].length > 0) {
            errMsgs.push("Username already taken");
        } else {
            let insertUserSQL = `INSERT into user (user_name, user_password) VALUES (?,?)`;
            let insertResult = await db.promise().query(insertUserSQL, [username, encryptedPassword]);
            let uid = insertResult[0].insertId;
            if (uid) {
                success=true;
                req.session.uid = uid;
                req.session.authen = uid;
                req.session.username = username;

                //todo: make this into a function
                let insertSQLcollection = `INSERT into collection (user_id, collection_name, is_wishlist) VALUES (?,?,?)`;
                if (uid) {
                    db.query(insertSQLcollection, [uid, username + "'s Collection", false], (err, dataset) => {
                        if (err) throw err;
                        db.query(insertSQLcollection, [uid, username + "'s Wishlist", true], (err, dataset) => {
                            if (err) throw err;

                        });

                    });
                }


            } else {
                let errMsg = "Something went wrong..."
            }

        }

    } else {
        [].concat(result.errors).forEach((err) => {
            errMsgs.push(err.msg);
        });
    }
    if (success) {
        res.redirect('/dashboard');
    } else {
        res.render("signup", { errMsgs: errMsgs });
    }

});

app.post("/add-card", async (req, res) => {
    //cant add cards to collection unless you're logged in
    const sess_obj = req.session;
    if (!sess_obj.authen) {
        res.send("Access Denied");
    } else {

        // ensure you cant add cards to someone elses collection
        const card_id = req.body.card_id;
        const collection_id = req.body.collection_id;
        let colls = await db.promise().query(`SELECT * FROM collection WHERE collection_id = ? AND user_id = ?`, [collection_id,sess_obj.authen]);
        if(colls[0].length>0){
            let insertSQLcardcollection = `INSERT into card_collection (collection_id, card_id) VALUES (?,?)`;
            db.query(insertSQLcardcollection, [collection_id, card_id], (err, dataset) => {
                req.flash('collectionMessage', 'Added to Collection!');
    
                res.redirect('back');
            });
        }else{
            res.send("Access Denied");
        }

    }
})

app.post("/remove-card", async (req, res) => {
    //cant remove cards from collection unless you're logged in
    const sess_obj = req.session;
    if (!sess_obj.authen) {
        res.send("Access Denied");
    } else {

        //cant remove cards from someone elses collection
        const card_id = req.body.card_id;
        const collection_id = req.body.collection_id;
        let colls = await db.promise().query(`SELECT * FROM collection WHERE collection_id = ? AND user_id = ?`, [collection_id,sess_obj.authen]);
        if(colls[0].length>0){

        let deleteSQLcardcollection = `DELETE FROM card_collection WHERE collection_id=? AND card_id=?`;
        db.query(deleteSQLcardcollection, [collection_id, card_id], (err, dataset) => {
            req.flash('collectionMessage', 'Card removed from Collection!');
            res.redirect('back');
        });
    }else{
        res.send("Access Denied");
    }

    }
})

app.get("/cards", async (req, res) => {
    const sess_obj = req.session;
    let lastQuery = req.query;
    let typeSQL = await db.promise().query(`SELECT * FROM type`);
    let types = typeSQL[0];

    let stageSQL = await db.promise().query(`SELECT DISTINCT stage FROM card WHERE stage<>''`);
    let stages = stageSQL[0];

    let raritySQL = await db.promise().query(`SELECT DISTINCT rarity FROM card WHERE rarity<>''`);
    let rarities = raritySQL[0];

    let categorySQL = await db.promise().query(`SELECT DISTINCT category FROM card WHERE category<>''`);
    let categories = categorySQL[0];

    let collections = [];

    if (sess_obj.authen) {
        let collectionsSQL = await db.promise().query(`SELECT collection.* FROM collection WHERE collection.user_id = ? ORDER BY collection.collection_id`, [sess_obj.authen]);
        collectionsSQL[0].forEach(async (row) => {
            row.cards = [];
            let cardCollectionsSQL = await db.promise().query(`SELECT card_id FROM card_collection WHERE collection_id = ? `, [row.collection_id]);
            cardCollectionsSQL[0].forEach((card) => {
                row.cards.push(card.card_id);
            });
            collections.push(row);
        });

    }

    let countSelect = `SELECT COUNT(card.card_id)  AS card_count FROM card `;
    let cardSelect = `SELECT card.*  FROM card `;
    let cardsQuery = `INNER JOIN \`set\` ON card.set_id=\`set\`.set_id INNER JOIN expansion ON set.expansion_id=expansion.expansion_id `;
    let joins = [];
    let wheres = [];
    let values = [];
    let orderby = ``;
    let limit = 24; //default
    let page = 0; //default


    //sorting options
    const sorts = new Map();
    sorts.set('pokedex', '-card.pokedex_id DESC'); //sort nulls last: https://stackoverflow.com/a/8174026
    sorts.set('nameasc', 'card.name ASC');
    sorts.set('namedesc', 'card.name DESC');
    const sortby = req.query.sortby;
    const sortby_orderby = ` ORDER BY ${sorts.get(sortby)}`;
    if (sortby != null && sorts.has(sortby)) {
        orderby = sortby_orderby;
    }

    //pagination and results per page
    const limit_results = req.query.limit;
    const results_page = req.query.page;
    if (limit_results != null) {
        limit = limit_results;
    }

    if (results_page != null) {
        page = results_page;
    }

    //query options
    const name = req.query.name;
    const name_where = `LOWER(card.name) LIKE ? `;
    if (name != null && name != '') {
        wheres.push(name_where);
        values.push("%" + name + "%");
    }

    const collection = req.query.collection;
    const collection_where = `card.card_id IN (SELECT card_collection.card_id FROM card_collection WHERE card_collection.collection_id IN (?))`;
    if (collection != null) {
        wheres.push(collection_where);
        values.push([].concat(collection));
    }

    const type = req.query.type;
    const type_join = `INNER JOIN card_type ON card.card_id=card_type.card_id INNER JOIN type ON card_type.type_id=type.type_id`;
    const type_where = `type.name IN (?)`;
    if (type != null && type != 'None') {
        joins.push(type_join);
        wheres.push(type_where);
        values.push([].concat(type));
    }

    const stage = req.query.stage;
    const stage_where = `card.stage IN (?)`;
    if (stage != null) {
        wheres.push(stage_where);
        values.push([].concat(stage));
    }

    const rarity = req.query.rarity;
    const rarity_where = `card.rarity IN (?)`;
    if (rarity != null) {
        wheres.push(rarity_where);
        values.push([].concat(rarity));
    }

    const category = req.query.category;
    const category_where = `card.category IN (?)`;
    if (category != null) {
        wheres.push(category_where);
        values.push([].concat(category));
    }

    const weakness = req.query.weakness;
    const weakness_join = `INNER JOIN weakness ON card.card_id=weakness.card_id`;
    const weakness_where = `weakness.type_id IN (SELECT type.type_id FROM type WHERE name IN (?))`;
    if (weakness != null) {
        joins.push(weakness_join);
        wheres.push(weakness_where);
        values.push([].concat(weakness));
    }

    const resistance = req.query.resistance;
    const resistance_join = `INNER JOIN resistance ON card.card_id=resistance.card_id`;
    const resistance_where = `resistance.type_id IN (SELECT type.type_id FROM type WHERE name IN (?))`;
    if (resistance != null) {
        joins.push(resistance_join);
        wheres.push(resistance_where);
        values.push([].concat(resistance));
    }

    const set = req.query.set;
    const set_where = `\`set\`.set_id = ?`;
    if (set != null) {
        wheres.push(set_where);
        values.push(set)
    }

    const expansion = req.query.expansion;
    const expansion_where = `expansion.expansion_id = ?`;
    if (expansion != null) {
        wheres.push(expansion_where);
        values.push(expansion);
    }


    //build the query
    cardsQuery += joins.join(' ');
    if (wheres.length > 0) {
        cardsQuery += " WHERE " + wheres.join(' AND ');
    }

    //get the count first
    countQuery = countSelect + cardsQuery;
    let queryCount = await db.promise().query(countQuery, values);
    queryCount = queryCount[0][0];

    //get the actual results
    cardsQuery = cardSelect + cardsQuery;
    cardsQuery += orderby;
    cardsQuery += ` LIMIT ${limit} OFFSET ${page * limit} `; //https://stackoverflow.com/a/53574331

    db.query(cardsQuery, values, (err, dataset) => {
        if (err) throw err;
        let origUrl = req.originalUrl.split('?')[1] ? req.originalUrl.split('?')[1] : "";
        res.render('cards',
            {
                origUrl: origUrl,
                totalCardCount: queryCount.card_count,
                limit: limit,
                page: page,
                cards: dataset,
                types: types,
                stages: stages,
                rarities: rarities,
                categories: categories,
                collections: collections,
                collection: collection,
                lastQuery: lastQuery,
                session: sess_obj
            });
    })
});

//moves to the next page in the cards view 
app.get('/cards-next', (req, res) => {
    req.query.page = req.query.page == null ? 1 : parseInt(req.query.page) + 1;
    res.redirect(url.format({
        pathname: "/cards",
        query: req.query,
    }));

})

//moves to the previous page in the cards view 
app.get('/cards-prev', (req, res) => {
    req.query.page = (req.query.page == null || parseInt(req.query.page) < 1) ? 0 : parseInt(req.query.page) - 1;
    res.redirect(url.format({
        pathname: "/cards",
        query: req.query,
    }));

})

//ONE CARD
app.get('/card', async (req, res) => {
    const card_id = req.query.id;
    const readcard = `SELECT * FROM card WHERE card_id = ? `;
    let cardSQL = await db.promise().query(readcard, [card_id]);
    let card = cardSQL[0][0];

    const readtype = `SELECT * FROM card_type INNER JOIN type ON card_type.type_id=type.type_id WHERE card_type.card_id=? `;
    let typeSQL = await db.promise().query(readtype, [card_id]);
    let types = typeSQL[0];
    card.types = types;

    const cardattack = `  SELECT attack.* FROM card
	INNER JOIN card_attack ON card_attack.card_id = card.card_id
    INNER JOIN attack ON card_attack.attack_id = attack.attack_id
WHERE card.card_id = ?`;
    let attackSQL = await db.promise().query(cardattack, [card_id]);
    let attacks = attackSQL[0];
    card.attacks = attacks;

    const cardabilties = `  SELECT ability.* FROM card
	INNER JOIN card_ability ON card_ability.card_id = card.card_id
    INNER JOIN ability ON card_ability.ability_id = ability.ability_id
WHERE card.card_id = ?`;
    let abilitySQL = await db.promise().query(cardabilties, [card_id]);
    let abilities = abilitySQL[0];
    card.abilities = abilities;

    const cardresist = ` SELECT * FROM resistance INNER JOIN type ON resistance.type_id = type.type_id WHERE resistance.card_id = ?`;
    let resistanceSQL = await db.promise().query(cardresist, [card_id]);
    let cardresistances = resistanceSQL[0];
    card.resistances = cardresistances;


    const cardweakness = ` SELECT * FROM weakness INNER JOIN type ON weakness.type_id = type.type_id WHERE weakness.card_id  = ?`;
    let weaknessSQL = await db.promise().query(cardweakness, [card_id]);
    let cardweaknesses = weaknessSQL[0];
    card.weaknesses = cardweaknesses;

    res.render('card', { card });

});


app.get(`/community`, (req, res) => {
    let communitySQL = `SELECT COUNT(card_collection.card_id) AS cardCount, collection.*, user.user_name FROM collection 
	    INNER JOIN user ON user.user_id = collection.user_id 
        INNER JOIN card_collection ON card_collection.collection_id=collection.collection_id
        WHERE collection.is_wishlist = 0
        GROUP BY collection.collection_id
        ORDER BY RAND() LIMIT 5 `;
    db.query(communitySQL, async (err, dataset) => {

        let collections = dataset
        let cardsList = [];
        let cardsCollectionSQL = `SELECT * FROM card_collection INNER JOIN card ON card_collection.card_id=card.card_id WHERE card_collection.collection_id = ? LIMIT 5 `;
        for (let i = 0; i < dataset.length; i++) {
            let cards = await db.promise().query(cardsCollectionSQL, [dataset[i].collection_id])

            cardsList = cardsList.concat(cards[0]);
        }

        res.render('community', { cards: cardsList, collections: collections })
    });

});

app.get(`/sets`, (req, res) => {
    let setSQL = `SELECT \`set\`.*, expansion.expansion_id, expansion.name AS 'expansion_name' FROM \`set\` LEFT JOIN expansion ON \`set\`.expansion_id=expansion.expansion_id`;
    db.query(setSQL, (err, dataset) => {
        let expansions = new Map();
        dataset.forEach((row) => {
            if (!expansions.has(row.expansion_id)) {
                expansions.set(row.expansion_id, { expansion_name: row.expansion_name, expansion_id: row.expansion_id });
            }
        });
        res.render('sets', { sets: dataset, expansions: expansions })
    });

});

app.get('*', (req, res) => {
    res.send("404! Whoops, I cannot find that!");
});

app.listen(PORT, () => console.log("Listening on port 3000!"));

