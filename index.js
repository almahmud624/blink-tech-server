const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const ObjectId = require("mongodb").ObjectId;

// .env
require("dotenv").config();

const port = process.env.PORT || 4000;

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Blink Tech Connected");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.4ieih.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    const productCollection = client.db("blink-tech").collection("products");
    const ordersCollection = client.db("blink-tech").collection("orders");
    // send data on server
    app.post("/products", async (req, res) => {
      const product = req.body;
      const result = await productCollection.insertOne(product);
      res.send(product);
    });
    // get data from server
    app.get("/products", async (req, res) => {
      const query = {};
      const cursor = productCollection.find(query);
      const products = await cursor.toArray();
      res.send(products);
    });
    //get single data
    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const product = await productCollection.findOne(query);
      res.send(product);
    });
    // delete product
    app.delete("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await productCollection.deleteOne(query);
      res.send(result);
    });
    // update product
    app.put("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const product = req.body;
      const option = { upsert: true };
      const updateProduct = {
        $set: {
          category: product.category,
          description: product.description,
          discount: product.discount,
          imgURL: product.imgURL,
          isTrending: product.isTrending,
          productName: product.productName,
          productPrice: product.productPrice,
          rating: product.rating,
          isPromoted: product.isPromoted,
        },
      };
      const result = await productCollection.updateOne(
        query,
        updateProduct,
        option
      );
      res.send(result);
    });

    // orders api
    // post orders
    app.post("/orders", async (req, res) => {
      const order = req.body;
      const result = await ordersCollection.insertOne(order);
      res.send(result);
    });

    // get orders
    app.get("/orders", async (req, res) => {
      let query = {};
      if (req.query.email) {
        query = {
          mail: req.query.email,
        };
        console.log(query);
      }
      const cursor = ordersCollection.find(query);
      const orders = await cursor.toArray();
      res.send(orders);
    });

    // order remove
  } finally {
    // client.close()
  }
}

run().catch((err) => console.log(err));

app.listen(port, () => {
  console.log("Blink Tech running on port", port);
});
