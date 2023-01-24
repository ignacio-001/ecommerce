const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const neo4j = require("neo4j-driver");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

// Create a new Express.js app
const app = express();

// Use the body-parser middleware to parse JSON request bodies
app.use(bodyParser.json());

// Use the cors middleware to allow cross-origin requests
app.use(cors());
const driver = neo4j.driver(
  "bolt://localhost:7687",
  neo4j.auth.basic("neo4j", "valery-sincere-saga-friend-armada-9011")
);
const session = driver.session();
app.listen(3001);
console.log("heeeeee");

// POST route to handle user login
app.post("/api/login", async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  // Check for required fields
  if (!email || !password) {
    return res.status(400).json({ message: "missing fields" });
  }

  try {
    const result = await session.run(
      `MATCH (u:User {email: $email}) RETURN u.password`,
      { email }
    );
    if (result.records.length) {
      const hashedPassword = result.records[0].get(0);
      // Compare the provided password with the hashed password in the database
      if (bcrypt.compareSync(password, hashedPassword)) {
        // Generate a JWT token
        const token = jwt.sign({ email }, "secretkey");
        // Send the token back to the client
        return res.status(200).json({ token });
      } else {
        return res.status(401).json({ message: "invalid credentials" });
      }
    } else {
      return res.status(401).json({ message: "invalid credentials" });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "internal server error" });
  }
});

// POST route to handle user registration
app.post("/api/register", async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  // Check for required fields
  if (!email || !password) {
    return res.status(400).json({ message: "missing fields" });
  }

  try {
    const result = await session.run(
      `MATCH (u:User {email: $email}) RETURN u`,
      { email }
    );
    if (result.records.length) {
      return res
        .status(400)
        .json({ message: "user with this email already exists" });
    }
    // Hash the password
    const hashedPassword = bcrypt.hashSync(password, 10);
    // Create a new user in the database
    await session.run(
      `CREATE (u:User {email: $email, password: $hashedPassword})`,
      { email, hashedPassword }
    );
   // Generate a JWT token
   const token = jwt.sign({ email }, "secretkey");
   // Send the token back to the client
   return res.status(201).json({ token });
 } catch (err) {
   console.log(err);
   return res.status(500).json({ message: "internal server error" });
 }
});

// GET route to handle user logout
app.get("/api/logout", (req, res) => {
 // Clear the JWT token from the client's local storage
 localStorage.removeItem("token");
 // Redirect the client to the login page
 return res.redirect("/login");
});

// Middleware to handle JWT verification
const verifyToken = (req, res, next) => {
 const token = req.headers["authorization"];
 if (!token) {
   return res.status(401).json({ message: "unauthorized" });
 }
 try {
   const decoded = jwt.verify(token, "secretkey");
   req.user = decoded;
   next();
 } catch (err) {
   return res.status(401).json({ message: "invalid token" });
 }
};

// GET route to handle getting a list of products added by a user
app.get("/api/products", verifyToken, async (req, res) => {
 try {
   const result = await session.run(
     `MATCH (u:User {email: $email})-[:POSTED]->(p:Product) RETURN p`,
     { email: req.user.email }
   );
   const products = result.records.map((record) => record.get(0));
   return res.status(200).json(products);
 } catch (err) {
   console.log(err);
   return res.status(500).json({ message: "internal server error" });
 }
});
// POST route to handle product creation
app.post("/api/productadd", async (req, res) => {
  const name = req.body.name;
  const description = req.body.description;
  const category = req.body.category;
  const price = req.body.price;
  const email = req.body.email;
  
  // Check for required fields
  if (!name || !description || !category || !price || !email) {
    return res.status(400).json({ message: "missing fields" });
  }

  try {
    // Create a new product in the database
    await session.run(
      `CREATE (p:Product {name: $name, description: $description, category: $category, price: $price, email: $email})`,
      { name, description, category, price, email }
    );
    return res.status(201).json({ message: "product created" });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "internal server error" });
  }
});

// PUT route to handle updating a product
app.put("/api/products/:id", verifyToken, async (req, res) => {
    const id = req.params.id;
    const name = req.body.name;
    const description = req.body.description;
    const category = req.body.category;
    const price = req.body.price;
  
    // Check for required fields
    if (!name || !description || !category || !price) {
      return res.status(400).json({ message: "missing fields" });
    }
  
    try {
      const result = await session.run(
        `MATCH (u:User {email: $email})-[:POSTED]->(p:Product {id: $id}) SET p += {name: $name, description: $description, category: $category, price: $price} RETURN p`,
        { email: req.user.email, id, name, description, category, price }
      );
      if (result.records.length) {
        const product = result.records[0].get(0);
        return res.status(200).json(product);
      } else {
        return res.status(404).json({ message: "product not found" });
      }
    } catch (err) {
      console.log(err);
      return res.status(500).json({ message: "internal server error" });
    }
  });
  