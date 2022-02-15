const express = require("express");
const Clarifai = require("clarifai");
const cors = require("cors");
const knex = require("knex");
const bcrypt = require("bcrypt");
const saltRounds = 10;

const app = express();

const clarifaiApp = new Clarifai.App({
  apiKey: "", //enter your api key here
});

app.use(express.json());
app.use(cors());

const db = knex({
  //make your db connection here
  client: "pg",
  connection: {
    host: "127.0.0.1",
    user: "postgres",
    port: 5432,
    password: "",
    database: "face-recognition",
  },
});

app.get("/", (req, res) => {
  //   console.log("home route");
  res.json(db.users);
});

app.post("/signin", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json("empty fields");
  }
  db.select("hash", "email")
    .from("login")
    .where("email", "=", email)
    .then((data) => {
      // console.log(data);
      const isValid = bcrypt.compareSync(password, data[0].hash);

      if (isValid) {
        db.select("*")
          .from("users")
          .where("email", "=", email)
          .then((user) => {
            res.json(user[0]);
          });
      } else {
        res.status(400).json("wrong credential");
      }
    })
    .catch((err) => {
      res.status(400).json("wrong credential");
    });
});

app.post("/register", (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json("empty fields");
  }
  const hash = bcrypt.hashSync(password, saltRounds);

  db.transaction((trx) => {
    trx
      .insert({
        hash: hash,
        email: email,
      })
      .into("login")
      .returning("email")
      .then((loginEmail) => {
        trx("users")
          .returning("*")
          .insert({
            email: loginEmail[0].email,
            name: name,
            joined: new Date(),
          })
          .then((users) => {
            res.json(users[0]);
          })
          .catch((err) => {
            res.status(400).json("err: cannot register");
          });
      })
      .then(trx.commit)
      .catch(trx.rollback);
  }).catch((err) => {
    res.status(400).json("unable to register");
  });
});

app.get("/profile/:id", (req, res) => {
  const { id } = req.params;
  db.select("*")
    .from("users")
    .where({
      id: id,
    })
    .then((user) => {
      if (user.length) {
        res.json(user[0]);
      } else {
        res.status(400).json("not found");
      }
    })
    .catch((err) => {
      res.status(400).json("err: getting user");
    });
});

app.put("/image", (req, res) => {
  const { id } = req.body;
  db("users")
    .where("id", "=", id)
    .increment("entries", 1)
    .returning("entries")
    .then((entries) => {
      // console.log(entries);
      res.json(entries[0].entries);
    })
    .catch((err) => res.json("err: updating entries"));
});

app.post("/apiCall", (req, res) => {
  clarifaiApp.models
    .predict(Clarifai.FACE_DETECT_MODEL, req.body.input) //"53e1df302c079b3db8a0a36033ed2d15"
    .then((data) => {
      res.json(data);
    })
    .catch((err) => {
      res.status(400).json("unable to get respons from api");
    });
});

app.listen(3000, () => {
  console.log("app is running at port 3000");
});
