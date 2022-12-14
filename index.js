const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const ObjectId = require("mongodb").ObjectId;
const jwt = require("jsonwebtoken");
// .env
require("dotenv").config();

const port = process.env.PORT || 4000;

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Blink Tech Connected");
});

// stripe key
const stripe = require("stripe")(process.env.STRIPE_SK);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.4ieih.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    // products collection
    const productCollection = client.db("blink-tech").collection("products");

    // orders collection
    const ordersCollection = client.db("blink-tech").collection("orders");

    // appointment options
    const appointmentOptions = client
      .db("blink-tech")
      .collection("appointmentOptions");

    // booking collection
    const bookingCollection = client
      .db("blink-tech")
      .collection("bookingCollection");

    // user collection
    const usersCollection = client
      .db("blink-tech")
      .collection("usersCollection");

    // JWT
    app.post("/jwt", (req, res) => {
      const user = req.body;

      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1d",
      });
      res.send({ token });
    });

    // jwt verify function
    const verifyJWT = (req, res, next) => {
      const jwtHeaders = req.headers.authorization;

      if (!jwtHeaders) {
        return res.status(401).send({ message: "Unauthorized Access" });
      }
      const token = jwtHeaders.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(403).send("Forbidden Access");
        }
        req.decoded = decoded;

        next();
      });
    };

    // valid admin check
    const adminCheck = async (req, res, next) => {
      const user = await usersCollection.findOne({ email: req.decoded.email });
      if (user?.role !== "admin") {
        res.status(403).send({ message: "Access Forbiden" });
        return;
      }
      next();
    };

    // send data on server
    app.post("/products", async (req, res) => {
      const product = req.body;
      const result = await productCollection.insertOne(product);
      res.send(result);
    });

    // get data from server
    app.get("/products", async (req, res) => {
      let query = {};

      // search on collection
      const searchText = req.query.search;
      if (searchText?.length) {
        query = {
          $text: {
            $search: searchText,
          },
        };
      }

      // sort product price in ascending & descending by query on client site by checkbox
      const order = req.query.order === "asc" ? 1 : -1;

      // convert price string to Int
      productCollection
        .find({}, { productPrice: 1 })
        .forEach(function (product) {
          productCollection.updateMany(
            { _id: product._id },
            { $set: { productPrice: parseFloat(product.productPrice) } }
          );
        });

      const cursor = productCollection.find(query);
      const products = await cursor.sort({ productPrice: order }).toArray();
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
    app.get("/orders", verifyJWT, async (req, res) => {
      // valid email check
      const decode = req.decoded;
      if (decode.email !== req.query.email) {
        res.status(403).send("Access Forbiden");
      }

      let query = {};

      // pagination
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);

      // get data by specific email
      if (req.query.email) {
        query = {
          mail: req.query.email,
        };
      }

      const cursor = ordersCollection.find(query);
      const orders = await cursor
        .skip(page * size)
        .limit(size)
        .toArray();

      // set total data count for pagination
      const count = await ordersCollection.estimatedDocumentCount();
      res.send({ count, orders });
    });

    //**!! */ remove all orders -> temporary api
    // app.delete("/orders", async (req, res) => {
    //   const result = await ordersCollection.deleteMany({});
    //   res.send(result);
    // });

    // order remove by put method
    app.put("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const productId = req.body.productId;
      const query = {
        _id: ObjectId(id),
      };
      const productDelete = {
        $pull: { orderInfo: { _id: productId } },
      };
      const result = await ordersCollection.updateOne(
        query,
        productDelete,
        false
      );
      res.send(result);
    });

    // patch order
    app.patch("/orders/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const { status, productId } = req.body;
      const query = { _id: ObjectId(id), "orderInfo._id": productId };

      const updateStatus = {
        $set: {
          "orderInfo.$.status": status,
        },
      };
      const result = await ordersCollection.updateOne(query, updateStatus);
      res.send(result);
    });

    // use aggregate to query multiple collection and the merge data
    app.get("/appointment-options", async (req, res) => {
      const date = req.query.date;
      const options = await appointmentOptions.find({}).toArray();

      // get booking data via selected date
      const bookingQuery = { selectedDate: date };
      const booked = await bookingCollection.find(bookingQuery).toArray();

      options.forEach((option) => {
        const bookedOption = booked.filter(
          (book) => book.service === option.name
        );
        const bookedSlots = bookedOption.map((bookOption) => bookOption.slot);
        const restSlot = option?.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
        option.slots = restSlot;
      });

      res.send(options);
    });

    /**
     * API naming convention
     * app.post('/bookings')
     * app.get('/bookings')
     * app.get('/bookings/:id')
     * app.patch('/bookings/:id')
     * app.delete('/bookings/:id')
     */

    // post booking data on server
    app.post("/bookings", async (req, res) => {
      const bookedQuery = {
        selectedDate: req.body.selectedDate,
        service: req.body.service,
        email: req.body.email,
      };
      const booked = await bookingCollection.find(bookedQuery).toArray();

      if (booked.length) {
        res.send({
          acknowledged: false,
          message: `You already have a booking on ${req.body.selectedDate}`,
        });
        return;
      }
      const result = await bookingCollection.insertOne(req.body);
      res.send(result);
    });

    // load bookings data from server
    app.get("/bookings", verifyJWT, async (req, res) => {
      // valid email check
      if (req.decoded?.email !== req.query?.email) {
        res.status(403).send("Access Forbiden");
      }

      const booking = await bookingCollection
        .find({ email: req.query.email })
        .toArray();
      res.send(booking);
    });

    // store user data on server
    app.post("/users", async (req, res) => {
      const duplicateUser = await usersCollection
        .find({ email: req.body.email })
        .toArray();

      if (duplicateUser.length) {
        return;
      }

      const result = await usersCollection.insertOne(req.body);
      res.send(result);
    });

    // get all users
    app.get("/users", verifyJWT, adminCheck, async (req, res) => {
      const users = await usersCollection.find({}).toArray();
      res.send(users);
    });

    // check admin or not
    app.get("/users/admin/:email", async (req, res) => {
      const user = await usersCollection.findOne({ email: req?.params.email });
      res.send({ isAdmin: user?.role === "admin" });
    });

    // set admin role on users
    app.patch("/users/admin/:id", verifyJWT, adminCheck, async (req, res) => {
      // check this user admin or not by user email
      // const user = await usersCollection.findOne({ email: req.decoded.email });
      // if (user?.role !== "admin") {
      //   res.status(403).send({ message: "Access Forbiden" });
      // }

      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(
        { _id: ObjectId(req.params?.id) },
        updateDoc
      );
      res.send(result);
    });

    // remove user
    app.delete("/users/admin/:id", verifyJWT, adminCheck, async (req, res) => {
      const result = await usersCollection.deleteOne({
        _id: ObjectId(req.params.id),
      });
      res.send(result);
    });

    // stripe payment
    app.post("/create-payment-intent", async (req, res) => {
      const price = req.body.price;
      const amount = price * 100; // convert price into decimal / paisa ????????????

      const paymentIntents = await stripe.paymentIntents.create({
        currency: "usd",
        amount,
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntents.client_secret,
      });
    });
  } finally {
    // client.close()
  }
}

run().catch((err) => console.log(err));

app.listen(port, () => {
  console.log("Blink Tech running on port", port);
});
