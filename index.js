const express = require('express');
const cors = require('cors');
var jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 5000;

// middleware

// app.use(cors());
// app.use(express.json());
// ----------------------

const corsConfig = {
    origin: true,
    Credentials: true,
}

app.use(
    cors({ origin: "*", methods: ["GET", "POST", "PUT", "PATCH", "DELETE"] }) 
    );
  

  
  



app.use(cors(corsConfig));
app.options('*', cors(corsConfig));
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ijodz.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });



function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    });

}

async function run() {

    try {
        await client.connect();
        const serviceCollection = client.db("doctors_portal").collection("services");
        const bookingCollection = client.db("doctors_portal").collection("booking");
        const userCollection = client.db("doctors_portal").collection("users");
        const doctorCollection = client.db("doctors_portal").collection("doctors");

        app.get('/service', async (req, res) => {

            const query = {};
            const cursor = serviceCollection.find(query).project({ name: 1 });
            const services = await cursor.toArray();
            res.send(services);

        });

        app.get('/user', async (req, res) => {

            const users = await userCollection.find().toArray();
            res.send(users);
        })


        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

            res.send({ result, token });


        })

        app.get('/available', async (req, res) => {
            const date = req.query.date || 'May 27, 2022';
            // get all services
            const services = await serviceCollection.find().toArray();
            // get booking that day
            const query = { date: date }
            const bookings = await bookingCollection.find(query).toArray();
            // for each service, find the bookings of that day
            services.forEach(service => {
                const serviceBookings = bookings.filter(book => book.treatment === service.name);

                const booked = serviceBookings.map(book => book.slot);

                const available = service.slots.filter(slot => !booked.includes(slot));
                service.slots = available;
            })
            res.send(services);
        })

        app.get('/booking', async (req, res) => {

            // verifyJWT
            const patient = req.query.patient;
            const authorization = req.headers.authorization;
            // console.log('auth header', authorization);
            const decodedEmail = req.decoded.email;
            if (patient === decodedEmail) {
                const query = { patient: patient }
                const bookings = await bookingCollection.find(query).toArray();
                res.send(bookings);
            }
            else {
                return res.status(403).send({ message: 'forbidden access' });
            }



        })


        app.post('/booking', async (req, res) => {

            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
            const exists = await bookingCollection.findOne(query);

            if (exists) {
                return res.send({ success: false, booking: exists })
            }

            const result = await bookingCollection.insertOne(booking);
            return res.send({ success: true, result });

        })


        app.get('/doctor', async (req, res) => {
            const doctors = await doctorCollection.find().toArray();
            res.send(doctors);
        })

        app.post('/doctor', async (req, res) => {
            const doctor = req.body;
            const result = await doctorCollection.insertOne(doctor);
            res.send(result);
        });


    }
    finally {


    }

}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello from Doctors Portal....///')
})

app.listen(port, () => {
    console.log(`Doctor app listening on port ${port}`)
})