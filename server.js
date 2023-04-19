const express = require("express");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const port = 5000;
const secretKey = "mysecretkey";

// Enable CORS for all routes
app.use(cors());

app.use(bodyParser.json());

const pool = new Pool({
  user: "talalahmaf",
  host: "localhost",
  database: "postgres",
  password: "pass123",
  port: 5432,
});

pool.connect((err, client, done) => {
  if (err) {
    console.error("Error connecting to PostgreSQL database:", err);
  } else {
    console.log("Connected to PostgreSQL database");
    client.query(
      `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT,
      password TEXT
    )`,
      (err, result) => {
        if (err) {
          console.error("Error creating users table:", err);
        } else {
          console.log("Created users table");
        }
      }
    );
    // create to-do table
    client.query(
      `CREATE TABLE IF NOT EXISTS todos (
        id SERIAL PRIMARY KEY,
        username TEXT,
        title TEXT,
        completed BOOLEAN
      )`,
      (err, result) => {
        if (err) {
          console.error("Error creating todos table:", err);
        } else {
          console.log("Created todos table");
        }
      }
    );

    // insert dummy to-do data if table is empty
    // create to-do table
    client.query(
      `CREATE TABLE IF NOT EXISTS todos (
        id SERIAL PRIMARY KEY,
        username TEXT,
        title TEXT,
        completed BOOLEAN
      )`,
      (err, result) => {
        if (err) {
          console.error("Error creating todos table:", err);
        } else {
          console.log("Created todos table");
        }
      }
    );

    // insert dummy to-do data
    // client.query(
    //   `INSERT INTO todos (username, title, completed)
    //    SELECT 'user1', 'Complete Assignment', false
    //    WHERE NOT EXISTS (SELECT 1 FROM todos LIMIT 1) UNION
    //    SELECT 'user1', 'Buy Groceries', false UNION
    //    SELECT 'user2', 'Go for a run', true UNION
    //    SELECT 'user2', 'Finish Reading Book', false`,
    //   (err, result) => {
    //     if (err) {
    //       console.error("Error inserting dummy todo data:", err);
    //     } else {
    //       console.log("Inserted dummy todo data into todos table");
    //     }
    //   }
    // );

    // const password1 = bcrypt.hashSync("pass1", 10);
    // client.query(
    //   `INSERT INTO users (username, password) VALUES ('user1', '${password1}')`,
    //   (err, result) => {
    //     if (err) {
    //       console.error("Error inserting user1:", err);
    //     } else {
    //       console.log("Inserted user1 into users table");
    //     }
    //   }
    // );
  }
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  pool.query(
    "SELECT * FROM users WHERE username = $1",
    [username],
    (err, result) => {
      if (err) {
        console.error("Error querying users:", err);
        res.status(500).send("Internal Server Error");
      } else if (result.rows.length === 0) {
        res.status(401).send("Invalid username or password");
      } else {
        const user = result.rows[0];
        bcrypt.compare(password, user.password, (err, match) => {
          if (err) {
            console.error("Error comparing passwords:", err);
            res.status(500).send("Internal Server Error");
          } else if (match) {
            const token = jwt.sign({ username }, secretKey);
            res.send({ token });
          } else {
            res.status(401).send("Invalid username or password");
          }
        });
      }
    }
  );
});

// POST /register
app.post("/register", (req, res) => {
  const { username, password } = req.body;

  // Check if the username is already taken
  pool.query(
    "SELECT * FROM users WHERE username = $1",
    [username],
    (err, result) => {
      if (err) {
        console.error("Error querying users:", err);
        res.status(500).send("Internal Server Error");
      } else if (result.rows.length > 0) {
        res.status(409).send("Username already taken");
      } else {
        // Hash the password using a library like bcrypt
        bcrypt.hash(password, 10, (err, hash) => {
          if (err) {
            console.error("Error hashing password:", err);
            res.status(500).send("Internal Server Error");
          } else {
            // Insert the new user into the database
            pool.query(
              "INSERT INTO users (username, password) VALUES ($1, $2)",
              [username, hash],
              (err) => {
                if (err) {
                  console.error("Error inserting user:", err);
                  res.status(500).send("Internal Server Error");
                } else {
                  res.status(201).send("User created");
                }
              }
            );
          }
        });
      }
    }
  );
});

// Define a middleware function to extract the JWT token from the Authorization header
const extractToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(" ")[1];
    req.token = token;
    next();
  } else {
    res.sendStatus(401);
  }
};

// Define a route that verifies the JWT token and returns the decoded user information
app.get("/todos", extractToken, (req, res) => {
  const token = req.token;
  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) {
      res.status(401).send("Unauthorized");
    } else {
      const username = decoded.username;
      pool.query(
        "SELECT * FROM todos WHERE username = $1",
        [username],
        (err, result) => {
          if (err) {
            console.error("Error querying todos:", err);
            res.status(500).send("Internal Server Error");
          } else {
            res.json(result.rows);
          }
        }
      );
    }
  });
});

// Create a new todo
app.post("/todos", extractToken, (req, res) => {
  const token = req.token;
  const decoded = jwt.decode(token);
  const username = decoded.username;
  const { title, completed } = req.body;

  pool.query(
    "INSERT INTO todos (username, title, completed) VALUES ($1, $2, $3)",
    [username, title, completed],
    (err, result) => {
      if (err) {
        console.error("Error creating todo:", err);
        res.status(500).send("Internal Server Error");
      } else {
        res.send("Todo created successfully");
      }
    }
  );
});

// Update an existing todo
app.put("/todos/:id", extractToken, (req, res) => {
  const token = req.token;
  const decoded = jwt.decode(token);
  const username = decoded.username;
  const id = req.params.id;
  const { title, completed } = req.body;

  pool.query(
    "UPDATE todos SET title = $1, completed = $2 WHERE id = $3 AND username = $4",
    [title, completed, id, username],
    (err, result) => {
      if (err) {
        console.error("Error updating todo:", err);
        res.status(500).send("Internal Server Error");
      } else if (result.rowCount === 0) {
        res.status(404).send("Todo not found");
      } else {
        res.send("Todo updated successfully");
      }
    }
  );
});

// Delete a todo
app.delete("/todos/:id", extractToken, (req, res) => {
  const token = req.token;
  const decoded = jwt.decode(token);
  const username = decoded.username;
  const id = req.params.id;

  pool.query(
    "DELETE FROM todos WHERE id = $1 AND username = $2",
    [id, username],
    (err, result) => {
      if (err) {
        console.error("Error deleting todo:", err);
        res.status(500).send("Internal Server Error");
      } else if (result.rowCount === 0) {
        res.status(404).send("Todo not found");
      } else {
        res.send("Todo deleted successfully");
      }
    }
  );
});
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
