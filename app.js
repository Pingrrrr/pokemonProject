const express = require("express");
flash = require('express-flash'); //https://www.npmjs.com/package/express-flash & https://stackoverflow.com/a/42341464
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser');
const sessions = require('express-session');
const bcrypt = require('bcrypt');
const url = require('url');
const saltRounds = 10;


var app = express();
const path = require('path');
const PORT = 3000;

const jsonParser = bodyParser.json();
const urlencodedParser = bodyParser.urlencoded({ extended: true })
const halfDay = 1000 * 60 * 60 * 12;

app.use(sessions({
    secret: "thisisVERYsecretVERYshush2",
    saveUninitialized: true,
    cookie: { maxAge: halfDay },
    resave: false 
}));

//https://stackoverflow.com/a/37184041
app.use(function(req, res, next) {
    res.locals.authen = req.session.authen;
    next();
  });


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
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser('keyboard cat'));
app.use(flash());
app.set("view engine", "ejs");


app.get("/", function (req, res) {
    
    const sessionobj = req.session;
    if(sessionobj.authen){
        res.redirect('/dashboard');
    }else{
        const readcard = `SELECT * FROM card ORDER BY RAND() LIMIT 12 `;
        db.query(readcard, (err, dataset) => {
            res.render("tradecard", { dataset });
        })

    }




});

app.get('/login', (req, res) => {
    res.render("login", {errMsg: ""});
});

app.post('/login', urlencodedParser, async (req, res) => {
    console.log(req.body);
    const username = req.body.username;
    const password = req.body.password;
    let sess_obj = req.session;
    
    const checkuser = `SELECT * FROM user WHERE user_name = "${username}" `;

    db.query(checkuser, async (err, rows) => {
        if(err) throw err;
        const numRows = rows.length;
        if(numRows > 0){
            //check the password
            const comparison = await bcrypt.compare(password, rows[0].user_password);
            if(comparison){
                sess_obj.authen = rows[0].user_id;
                sess_obj.username = username;
                res.redirect('/dashboard');
            }else{
                let errMsg = 'Incorrect username or password';
                res.render("login", {errMsg:errMsg});
            }

            
        }else{
            let errMsg = 'Incorrect username or password';
            res.render("login", {errMsg:errMsg});
        }
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/dashboard',(req, res)=>{
    console.log("get dashboard");
    const sessionobj = req.session;
    
    if(sessionobj.authen){
        const collectionsSQL = `SELECT * FROM collection WHERE user_id =${sessionobj.authen}`;
        db.query(collectionsSQL,(err, dataset) => {
            res.render("dashboard", {collections: dataset, session: req.session});
        });
        
    }else{
        res.send("403: access denied");
    } 
});

app.post('/dashboard', urlencodedParser, (req, res)=>{
    const sessionobj = req.session;
    const collection = req.body.collection;
    let insertSQLcollection = `INSERT into collection (user_id, collection_name, is_wishlist) VALUES (?,?,?)`;

    if(sessionobj.authen){
        db.query ( insertSQLcollection, [sessionobj.authen,collection,false], (err, dataset) => {
            if (err) throw err;
            res.redirect('/dashboard');
        });
    }else{
        res.send("403: access denied");
    } 
});


app.get('/signup', (req, res) => {
    res.render("signup");
});

//https://kennethscoggins.medium.com/how-to-use-mysql-password-encryption-with-nodejs-express-and-bcrypt-ad9ede661109
app.post('/signup', urlencodedParser ,async (req, res) => {
    console.log("posted signup");
    const username = req.body.username;
    const password = req.body.password;    
    const encryptedPassword = await bcrypt.hash(password, saltRounds);

    let insertUserSQL = `INSERT into user (user_name, user_password) VALUES (?,?)`;
    let insertResult = await db.promise().query(insertUserSQL, [username,encryptedPassword]);
    let uid = insertResult[0].insertId;
    if(uid){
        req.session.uid = uid;
        req.session.authen = uid;
        req.session.username = username;

        //todo: make this into a function
        let insertSQLcollection = `INSERT into collection (user_id, collection_name, is_wishlist) VALUES (?,?,?)`;
        if(uid){
            db.query ( insertSQLcollection, [uid,username+"'s Collection",false], (err, dataset) => {
                if (err) throw err;
                db.query ( insertSQLcollection, [uid,username+"'s Wishlist",true], (err, dataset) => {
                    if (err) throw err;
                    
                });

            });
        }

    
        res.redirect('/dashboard');
    }else{
        let errMsg = "Something went wrong..."
        res.render("signup", {errMsg: errMsg});
    }

});

app.post("/add-card", (req, res) =>{
    //cant add cards to collection unless you're logged in
    const sess_obj = req.session;
    if(!sess_obj.authen){
        res.send("Access Denied");
    }else{

        //todo: cant add cards to someone elses collection
        const card_id = req.body.card_id;
        const collection_id = req.body.collection_id;
        let insertSQLcardcollection = `INSERT into card_collection (collection_id, card_id) VALUES (${collection_id},${card_id})`;
        console.log(insertSQLcardcollection);
        db.query(insertSQLcardcollection,(err, dataset)=>{
            req.flash('collectionMessage', 'Added to Collection!');
         
            res.redirect('back');
        });

    }
})

app.post("/remove-card", (req, res) =>{
    //cant remove cards from collection unless you're logged in
    const sess_obj = req.session;
    if(!sess_obj.authen){
        res.send("Access Denied");
    }else{

        //todo: cant remove cards from someone elses collection
        const card_id = req.body.card_id;
        const collection_id = req.body.collection_id;
        let deleteSQLcardcollection = `DELETE FROM card_collection WHERE collection_id=${collection_id} AND card_id=${card_id}`;
        console.log(deleteSQLcardcollection);
        db.query(deleteSQLcardcollection,(err, dataset)=>{
            req.flash('collectionMessage', 'Card removed from Collection!');
            res.redirect('back');
        });

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

    let collections=[];

    if(sess_obj.authen){
        let collectionsSQL = await db.promise().query(`SELECT collection.* FROM collection WHERE collection.user_id = ${sess_obj.authen} ORDER BY collection.collection_id`);
        console.log(collectionsSQL[0]);
        collectionsSQL[0].forEach(async (row)=>{
            console.log(row);
            row.cards=[];
            let cardCollectionsSQL = await db.promise().query(`SELECT card_id FROM card_collection WHERE collection_id = ${row.collection_id}`);
            cardCollectionsSQL[0].forEach((card)=>{
                row.cards.push(card.card_id);
            });
            console.log(row.cards);
            collections.push(row);
        });

        //collections = collectionsSQL[0];
        console.log("collections");
        console.log(collections);
    }

    let countSelect = `SELECT COUNT(card.card_id)  AS card_count FROM card `;
    let cardSelect = `SELECT card.*  FROM card `;
    let cardsQuery = `INNER JOIN \`set\` ON card.set_id=\`set\`.set_id INNER JOIN expansion ON set.expansion_id=expansion.expansion_id `;
    let joins = [];
    let wheres = [];
    let orderby = ``;
    let limit = 25; //default
    let page = 0; //default



    const sorts = new Map();
    sorts.set('pokedex', '-card.pokedex_id DESC'); //sort nulls last: https://stackoverflow.com/a/8174026
    sorts.set('nameasc', 'card.name ASC');
    sorts.set('namedesc', 'card.name DESC');


    const limit_results = req.query.limit;
    const results_page = req.query.page;

    const sortby = req.query.sortby;
    const sortby_orderby=` ORDER BY ${sorts.get(sortby)}`;

    const name = req.query.name;
    const name_where = `LOWER(card.name) LIKE "%${name}%"`;

    const collection = req.query.collection;
    const collection_where = `card.card_id IN (SELECT card_collection.card_id FROM card_collection WHERE card_collection.collection_id IN ('${[].concat(collection).join(`','`)}'))`;

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

    const set = req.query.set;
    const set_where = `\`set\`.set_id = ${set}`;

    const expansion = req.query.expansion;
    const expansion_where = `expansion.expansion_id = ${expansion}`;

    if(limit_results!=null){
        limit=limit_results;
    }

    if(results_page!=null){
        page=results_page;
    }

    if(sortby!=null ){
        orderby=sortby_orderby;
    }

    if(name!=null && name!=''){
        wheres.push(name_where);
    }

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

    if(collection!=null){
        wheres.push(collection_where);
    }

    if(weakness!=null){
        joins.push(weakness_join);
        wheres.push(weakness_where);
    }

    if(resistance!=null){
        joins.push(resistance_join);
        wheres.push(resistance_where);
    }

    if(set!=null ){
        wheres.push(set_where);
    }

    if(expansion!=null ){
        wheres.push(expansion_where);
    }

    cardsQuery += joins.join(' ');
    if(wheres.length>0){
        cardsQuery+=" WHERE "+wheres.join(' AND ');
    }

    
    

    countQuery=countSelect+cardsQuery;
    console.log(countQuery);
    let queryCount = await db.promise().query(countQuery);
    queryCount = queryCount[0][0];
    console.log(queryCount);

    cardsQuery=cardSelect+cardsQuery;

    //order and limit the actual query
    cardsQuery+=orderby;
    cardsQuery+=` LIMIT ${limit} OFFSET ${page*limit} `; //https://stackoverflow.com/a/53574331
    console.log(cardsQuery);
    console.log(lastQuery.type);
    let origUrl = req.originalUrl.split('?')[1] ? req.originalUrl.split('?')[1]:"";
    console.log("ORIGINAL URL: "+origUrl);

    
    db.query(cardsQuery, (err, dataset) => {
        if (err) throw err;
        console.log(lastQuery);
        res.render('cards', 
            { 
                origUrl:  origUrl,
                totalCardCount: queryCount.card_count,
                limit: limit,
                page: page,
                cards: dataset, 
                types: types, 
                stages: stages, 
                rarities:rarities, 
                categories:categories, 
                collections:collections, 
                collection: collection,
                lastQuery:lastQuery, 
                session:sess_obj });
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

app.get('/cards-next', (req, res)=>{
    req.query.page = req.query.page==null?1:parseInt(req.query.page)+1;
    res.redirect(url.format({
        pathname:"/cards",
        query:req.query,
      }));

})

app.get('/cards-prev', (req, res)=>{
    req.query.page = (req.query.page==null || parseInt(req.query.page)<1)?0:parseInt(req.query.page)-1;
    res.redirect(url.format({
        pathname:"/cards",
        query:req.query,
      }));

})



app.get(`/community`,  (req, res) => {
    let communitySQL = `SELECT collection.*, user.user_name FROM collection INNER JOIN user ON user.user_id = collection.user_id ORDER BY RAND() LIMIT 5; `;
    db.query(communitySQL, async (err, dataset) => {

        console.log(dataset);
        let collections = dataset
        let cardsList = [];
        let cardsCollectionSQL = `SELECT * FROM card_collection INNER JOIN card ON card_collection.card_id=card.card_id WHERE card_collection.collection_id = ? LIMIT 5; `;
        for(let i =0; i<dataset.length;i++){
            let cards = await db.promise().query(cardsCollectionSQL, [dataset[i].collection_id])
            console.log("CARDS::")
            console.log(cards[0])
           cardsList = cardsList.concat(cards[0]);
        }

        console.log("CARDSLIST");
        console.log(cardsList);
        res.render('community', {cards:cardsList, collections:collections})
    });
    
});

app.get(`/sets`, (req, res) => {
    let setSQL = `SELECT \`set\`.*, expansion.expansion_id, expansion.name AS 'expansion_name' FROM \`set\` LEFT JOIN expansion ON \`set\`.expansion_id=expansion.expansion_id`;
    db.query(setSQL, (err, dataset) => {
        console.log(dataset);
        let expansions = new Map();
        dataset.forEach((row)=>{
            if(!expansions.has(row.expansion_id)){
                expansions.set(row.expansion_id, {expansion_name:row.expansion_name, expansion_id:row.expansion_id});
            }
        });
        console.log(expansions);
        res.render('sets', {sets:dataset, expansions:expansions})
    });
    
});

app.get('*', (req, res) => {
    res.send("404! Whoops, I cannot find that!");
});

app.listen(PORT, () => console.log("Listening on port 3000!"));

