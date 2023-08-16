const express = require('express');
const cors = require('cors');
const app = express()
require('dotenv').config()
const port = process.env.PORT || 5000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


//middleware
app.use(cors())
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xwxepqp.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


async function run() {
    try {

        const contactsCollection = client.db('contactsManagement').collection('contacts')


        app.get('/contactsSearchByName/:text', async (req, res) => {
            const searchText = req.params.text
            console.log(searchText);

            const result = await contactsCollection.find({
                $or: [

                    { name: { $regex: searchText, $options: "i" } },
                ],

            }).toArray()
            res.send(result)
        })


        // contacts post
        app.post('/contacts', async (req, res) => {
            const contacts = req.body
            const result = await contactsCollection.insertOne(contacts)
            res.send(result)
        })


        // contacts get
        app.get('/contacts', async (req, res) => {
            const result = await contactsCollection.find().toArray()
            res.send(result);
        })

        // specific email
        app.get('/contacts/email/:email', async (req, res) => {
            const queryEmail = req.params.email;
            const query = { email: queryEmail };
            const result = await contactsCollection.find(query).toArray();
            res.send(result);
        })


        app.delete('/contacts/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await contactsCollection.deleteOne(query)
            res.send(result)
        })

        // get id
        app.get('/contacts/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await contactsCollection.findOne(query)
            res.send(result)
        })


        //contacts update
        app.put('/contacts/:id', async (req, res) => {
            const id = req.params.id
            const user = req.body
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true }
            const updatedUser = {
                $set: {
                    name: user.name,
                    email: user.email,
                    number: user.number,
                    date: user.date,
                    description: user.description,

                }
            }
            const result = await contactsCollection.updateOne(filter, updatedUser, options)
            res.send(result)
        })




        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('contact is calling')

})

app.listen(port, () => {
    console.log(`contact server running on ${port}`);
})