const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion } = require("mongodb");
const verify = require("jsonwebtoken/verify");

// middleware
app.use(cors());
app.use(express.json());
function JWTverify(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ message: "unauthorized assess" });
  }
  const token = authHeader.split(" ")[1];
  // jwt token verification
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRECT, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden assess" });
    }
    req.decoded = decoded;
    next();
  });
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nrxab.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();
    const serviceCollection = client.db("doctorPortal").collection("service");
    const bookingCollection = client.db("doctorPortal").collection("bookings");
    const userCollection = client.db("doctorPortal").collection("users");
    // isAdmin user
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.roll === "admin";
      res.send({ admin: isAdmin });
    });
    // get all service in data base
    app.get("/service", async (req, res) => {
      const query = {};
      const cursor = serviceCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // get booking data
    app.get("/booking", JWTverify, async (req, res) => {
      const patient = req.query.patient;
      const decodedEmail = req.decoded.email;
      if (decodedEmail === patient) {
        const query = { patient: patient };
        const result = await bookingCollection.find(query).toArray();
        res.send(result);
      } else {
        res.status(403).send({ message: "forbidden assess" });
      }
    });
    // user booking data save in database
    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const query = {
        treatmentName: booking.treatmentName,
        data: booking.data,
        patient: booking.patient,
      };
      const exits = await bookingCollection.findOne(query);
      if (exits) {
        return res.send({ success: false, booking: exits });
      }
      const result = await bookingCollection.insertOne(booking);
      res.send({ success: true, result });
    });
    // get all registered user
    app.get("/user", JWTverify, async (req, res) => {
      const query = {};
      const cursor = userCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // login or registered user data save in data base
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const accessToken = jwt.sign(
        {
          email: email,
        },
        process.env.ACCESS_TOKEN_SECRECT,
        { expiresIn: "1h" }
      );
      res.send({ result, accessToken });
    });
    // make an admin roll in user collection
    app.put("/user/admin/:email", JWTverify, async (req, res) => {
      const email = req.params.email;
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });
      if (requesterAccount.roll) {
        const filter = { email: email };
        const updateDoc = {
          $set: {
            roll: "admin",
          },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      } else {
        res.status(403).send({ message: "forbidden" });
      }
    });
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("start doctor portal");
});

app.listen(port, () => {
  console.log(`Doctor portal listening on port ${port}`);
});
