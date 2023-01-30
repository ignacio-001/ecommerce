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
        const token = jwt.sign({ email }, "secretkey",{expiresIn:'3d'});
        // Send the token back to the client
        return res.status(200).json({ token:token,email:email });
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
 console.log(token)
 if (!token) {
   return res.status(401).json({ message: "unauthorized" });
 }
 try {
  const temp=token.split(' ')[1];
   const decoded = jwt.verify(temp, "secretkey");
   req.user = decoded;
   next();
 } catch (err) {
   return res.status(401).json({ message: "invalid token" });
 }
};

// GET route to handle getting a list of products added by a user
app.get("/api/products", verifyToken, async (req, res) => {
  console.log(req.body);
 try {
  console.log(req.user);
   const result = await session.run(
     `MATCH (u:User {email: $email})-[:POSTED]->(p:Product) RETURN p`,
     { email: req.user.email }
   );
  //  console.log(result);
   const products = result.records.map((record) => record.get(0));
   return res.status(200).json(products);
 } catch (err) {
   console.log(err);
   return res.status(500).json({ message: "internal server error" });
 }
});
app.get("/api/products/:id", (req, res) => {
  const productId = req.params.id;
  session
      .run(`MATCH (p:Product) WHERE elementId(p) = $productId RETURN p`, { productId })
      .then(result => {
          if(result.records.length > 0) {
            console.log(result.records[0].get("p").properties)
              res.send(result.records[0].get("p").properties);
          } else {
              res.status(404).send({ message: "Product not found"});
          }
      })
      .catch(error => {
          console.log(error);
          res.status(500).send({ message: "Error fetching product"});
      });
});

// POST route to handle product creation
app.post("/api/productadd",verifyToken, async (req, res) => {
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
    // Find the user with the specified email
    const user = await session.run(
      `MATCH (u:User {email: $email}) RETURN u`,
      { email }
    );
    if (user.records.length === 0) {
      return res.status(404).json({ message: "user not found" });
    }
    const userNode = user.records[0].get(0);
    // Create a new product in the database
    const userId = userNode.elementId;
    console.log(userId);
    // Create a new product in the database
    const product = await session.run(
      `MATCH (u:User) WHERE elementId(u) = $userId
      CREATE (p:Product {name: $name, description: $description, category: $category, price: $price, email: $email})
      CREATE (u)-[:POSTED]->(p)
    RETURN p, u`,
      { name, description, category, price, email, userId }
    );
    return res.status(201).json({ message: "product created" });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "internal server error" });
  } 
});

// PUT route to handle updating a product
app.put("/api/productadd/:id", verifyToken, async (req, res) => {
    const id = req.params.id;
    const name = req.body.name;
    const description = req.body.description;
    const category = req.body.category;
    const price = req.body.price;
    console.log(id,'here');
    // Check for required fields
    if (!name || !description || !category || !price) {
      return res.status(400).json({ message: "missing fields" });
    }
    try {
      const result = await session.run(
        `MATCH (u:User {email: $email})-[:POSTED]->(p:Product WHERE elementId(p)=$id) SET p += {name: $name, description: $description, category: $category, price: $price} RETURN p`,
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
  app.delete("/api/product/:id", verifyToken, async (req, res) => {
    const id = req.params.id;
    console.log(id,'here');
    try {
    const result = await session.run(
    `MATCH (u:User {email: $email})-[:POSTED]->(p:Product WHERE elementId(p)=$id) DETACH  DELETE p`,
    { email: req.user.email, id }
    );
    if (result.summary.counters) {
    return res.status(200).json({ message: "product deleted successfully"});
    } else {
    return res.status(404).json({ message: "product not found" });
    }
    } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "internal server error" });
    }
    });
    
    
    
    
    