const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;
// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  
  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.un7bp9y.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10,
  });

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    //await client.connect();
    client.connect((error)=>{
        if(error){
          console.log(error)
          return;
        }
      });

    const instructorCollection = client.db("summerCampDb").collection("instructors");
    const classCollection = client.db("summerCampDb").collection("classes");
    const cartCollection = client.db("summerCampDb").collection("carts");
    const usersCollection = client.db("summerCampDb").collection("users");
    const paymentCollection = client.db("summerCampDb").collection("payments");
    
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

      res.send({ token })
    })

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }
    app.get('/users',verifyJWT,verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'instructor') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }

    
    app.get('/users',verifyJWT,verifyInstructor, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    
    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })
    app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      
      if (req.decoded.email !== email) {
        res.send({ instructor: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === 'instructor' }
      res.send(result);
    })
    
    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);

    })
    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'instructor'
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);

    })
    
    app.get('/instructors', async(req, res) =>{
        const result = await instructorCollection.find().toArray();
        res.send(result);
    })
    
    app.post('/classes', verifyJWT, verifyInstructor, async (req, res) => {
      const newClass = req.body;
      const result = await classCollection.insertOne(newClass)
      res.send(result);
    })
    app.get('/classes/:id', async(req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      
      const result = await classCollection.findOne(query);
      res.send(result);
  })
    app.get('/classes', async(req, res) =>{
        const result = await classCollection.find().toArray();
        res.send(result);
    })
    app.delete('/classes/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await classCollection.deleteOne(query);
      res.send(result);
    })


    app.put('/classes/:id/approvalstatus', async(req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const options = { upsert: true };
      const updatedClass = req.body;
    
      const classs = {
          $set: {
            approval_status: updatedClass.approval_status, 
           
             
              
          }
      }
    
    
      const result = await classCollection.updateOne(filter, classs, options);
      res.send(result);
    })   
    
    app.put('/classes/:id/price', async(req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const options = { upsert: true };
      const updatedClass = req.body;
    
      const classs = {
          $set: {
            
            price: updatedClass.price, 
             
              
          }
      }
    
      const result = await classCollection.updateOne(filter, classs, options);
      res.send(result);
    })    


    
    app.put('/classes/:id/feedback', async(req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const options = { upsert: true };
      const updatedClass = req.body;
    
      const classs = {
          $set: {
            
            feedback: updatedClass.feedback, 
             
              
          }
      }
    
      const result = await classCollection.updateOne(filter, classs, options);
      res.send(result);
    })    
    app.put('/classes/:id/seats', async(req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const options = { upsert: true };
      const updatedClass = req.body;
    
      const classs = {
          $set: {
            
            available_seats: updatedClass.available_seats, 
            enrolled: updatedClass.enrolled
             
              
          }
      }
    
      const result = await classCollection.updateOne(filter, classs, options);
      res.send(result);
    })    

    app.get('/allcarts', async(req, res) =>{
      const result = await cartCollection.find().toArray();
      res.send(result);
  })
  app.get('/allcarts/:id', async(req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) }
    
    const result = await cartCollection.findOne(query);
    res.send(result);
})
   

    app.get('/carts',verifyJWT, async (req, res) => {
      const email = req.query.email;
      
      if (!email) {
        res.send([]);
      }
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      
      res.send(result);
    })
    
    
    app.post('/carts', async (req, res) => {
      const classs = req.body;
      
      const result = await cartCollection.insertOne(classs);
      res.send(result);
    })

    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      console.log(result);
      res.send(result);
    })
    
    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'aud',
        payment_method_types: ['card']
      });
      app.patch("/payments/:id", (req, res) => {
        const { id } = req.params;
        const { status } = req.body;
      
        // Update the payment status in MongoDB
        Payment.findByIdAndUpdate(
          id,
          { status },
          { new: true },
          (err, updatedPayment) => {
            if (err) {
              console.log("Error updating payment status:", err);
              return res.status(500).json({ error: "Internal server error" });
            }if (!updatedPayment) {
              return res.status(404).json({ error: "Payment not found" });
            }
      
            return res.json({ success: true, payment: updatedPayment });
          }
        );
      });
      
  
  //     app.post('/payments', verifyJWT, async (req, res) => {
  //       const payment = req.body;
  //       const insertResult = await paymentCollection.insertOne(payment);
  
  //       const query = { _id: { $in: payment.cartClasses.map(id => new ObjectId(id)) } }
  //       const deleteResult = await cartCollection.deleteMany(query)
  
  //       res.send({ insertResult, deleteResult });
  //     })

  //     res.send({
  //       clientSecret: paymentIntent.client_secret
  //     })
  //   })
  //   app.get('/payments', async(req, res) =>{
  //     const result = await paymentCollection.find().toArray();
  //     res.send(result);
  // })

  
  app.post('/payments', verifyJWT, async (req, res) => {
    const payment = req.body;
    console.log(payment);
    const insertResult = await paymentCollection.insertOne(payment);
    //const query = { _id: new ObjectId(id) };
   // const query = { _id: { $in: new payment.cartClass.map(id => new ObjectId(id)) } }
   //const query = { _id: new ObjectId(payment.cartClass.toString()) };


   //console.log(query);
   // const query = { _id: { $in: [new ObjectId(payment.cartClass)] } };
   //const query = { _id: ObjectId(payment.cartClass) };
  //  const deleteResult = await cartCollection.deleteMany(query)
    //const deleteResult = await cartCollection.deleteMany(query);

    
    //console.log(query);
    res.send({ insertResult });
  })
  app.delete('/allcarts/:id',async (req, res) => {
    const id = req.params.id;
    console.log(id);
    const query = { _id: new ObjectId(id) };
    const result = await cartCollection.deleteOne(query);
    console.log(result);
    res.send(result);
  });
  
  res.send({
    clientSecret: paymentIntent.client_secret
  })
  app.get('/payments', async(req, res) =>{
    const result = await paymentCollection.find().toArray();
    res.send(result);
  })
})






    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) =>{
   
    res.send("welcome to summer camp of fashion school");
})

app.listen(port, () => {
    console.log(`Fashion Fiesta on port ${port}`);
})