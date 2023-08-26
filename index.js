const express = require('express');
const cors = require('cors');
const app = express()
const jwt = require('jsonwebtoken')
require('dotenv').config()
const port = process.env.PORT || 5000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");




//middleware
app.use(cors())
app.use(express.json())
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});


// verify jwt
const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }
    // bearer token
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}





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
        const sharedContactsCollection = client.db('contactsManagement').collection('sharedContacts')


        //jwt
        app.post('/jwt', (req, res) => {
            const user = req.body
            console.log(user);
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1h'
            })
            res.send({ token })

        })




        // shared contacts
        app.get("/shared-contacts", async (req, res) => {
            try {
                if (!req.headers.authorization) {
                    return res.status(401).send("Unauthorized");
                }
                // Verify the Firebase ID token
                const idToken = req.headers.authorization.replace("Bearer ", "");
                console.log(idToken);
                const decodedToken = await admin.auth().verifyIdToken(idToken);
                const uid = decodedToken.uid;

                // Fetch shared contacts associated with the user
                const sharedContacts = await sharedContactsCollection
                    .find({ uid: uid })
                    .toArray();

                res.status(200).json(sharedContacts);
            } catch (error) {
                console.error("Error fetching shared contacts:", error);
                res.status(500).send("Internal server error");
            }
        });

        // Endpoint to modify permission for a shared contact
        app.put("/shared-contacts/:id", async (req, res) => {
            try {
                const contactId = req.params.id;
                const { permissions } = req.body;

                // Verify the Firebase ID token
                const idToken = req.headers.authorization.replace("Bearer ", "");
                const decodedToken = await admin.auth().verifyIdToken(idToken);
                const uid = decodedToken.uid;

                // Update permissions for the shared contact
                await sharedContactsCollection.updateOne(
                    { _id: new ObjectId(contactId), uid: uid },
                    { $set: { permissions } }
                );

                res.status(200).send("Permission modified successfully");
            } catch (error) {
                console.error("Error modifying permission:", error);
                res.status(500).send("Internal server error");
            }
        });


        // Endpoint to revoke permission for a shared contact
        app.delete("/shared-contacts/:id", async (req, res) => {
            try {
                const contactId = req.params.id;

                // Verify the Firebase ID token
                const idToken = req.headers.authorization.replace("Bearer ", "");
                const decodedToken = await admin.auth().verifyIdToken(idToken);
                const uid = decodedToken.uid;

                // Remove the shared contact entry
                await sharedContactsCollection.deleteOne({
                    _id: new ObjectId(contactId),
                    uid: uid,
                });

                res.status(200).send("Permission revoked successfully");
            } catch (error) {
                console.error("Error revoking permission:", error);
                res.status(500).send("Internal server error");
            }
        });

        app.get("/shared-contacts/:id", async (req, res) => {
            try {
                const contactId = req.params.id;

                // Extract the ID token from the "Authorization" header
                const idToken = req.headers.authorization.replace("Bearer ", "");

                // Verify the Firebase ID token
                const decodedToken = await admin.auth().verifyIdToken(idToken);
                const uid = decodedToken.uid;

                // Fetch the specific shared contact
                const sharedContact = await sharedContactsCollection.findOne({
                    _id: new ObjectId(contactId),
                    uid: uid,
                });

                if (!sharedContact) {
                    return res.status(404).send("Shared contact not found");
                }

                res.status(200).json(sharedContact);
            } catch (error) {
                console.error("Error fetching shared contact:", error);
                res.status(500).send("Internal server error");
            }
        });




        app.post("/share-contacts", async (req, res) => {
            try {
                const { selectedContacts, selectedPermission, sharedBy } = req.body;

                // Check if the "Authorization" header exists in the request
                if (!req.headers.authorization) {
                    return res.status(401).send("Unauthorized");
                }

                // Extract the ID token from the "Authorization" header
                const idToken = req.headers.authorization.replace("Bearer ", "");

                // Verify the Firebase ID token
                const decodedToken = await admin.auth().verifyIdToken(idToken);
                const uid = decodedToken.uid;

                // Fetch selected contacts from the database
                const contactsToShare = await contactsCollection
                    .find({
                        _id: { $in: selectedContacts.map(contact => new ObjectId(contact.contactId)) }
                    })
                    .toArray();

                // Create shared contact entries for each selected contact
                const sharedContacts = contactsToShare.map(contact => ({
                    contactId: contact._id,
                    sharedBy: sharedBy,
                    uid: uid,// Use the UID from the decoded token
                    contactName: contact.name,
                    permissions: selectedPermission
                }));

                // Insert sharedContacts into the shared contacts collection
                await sharedContactsCollection.insertMany(sharedContacts);

                res.status(201).send("Contacts shared successfully");
            } catch (error) {
                console.error("Error sharing contacts:", error);
                res.status(500).send("Internal server error");
            }
        });





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
        app.get('/contacts/email/:email', verifyJWT, async (req, res) => {
            const queryEmail = req.params.email;
            const query = { email: queryEmail };
            const decodedEmail = req.decoded.email;
            if (queryEmail !== decodedEmail) {
                return res.status(401).send({ error: true, message: 'forbidden access' })
            }
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
                    group: user.group,
                    description: user.description,

                }
            }
            const result = await contactsCollection.updateOne(filter, updatedUser, options)
            res.send(result)
        })




        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
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