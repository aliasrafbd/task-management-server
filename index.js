const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors({
    origin: ['https://task-management-21-02-25.netlify.app', 'http://localhost:5173'],
    credentials: true
}));


app.use(express.json());


// 103.134.124.1

// console.log(process.env.DB_USER);

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.sa1jr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const usersCollection = client.db('taskDB').collection('users');
        const tasksCollection = client.db('taskDB').collection('tasks');


        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existingUser = await usersCollection.findOne(query);

            if (existingUser) {
                return res.send({ message: "User already exists", insertedId: null });
            }

            const newUser = {
                uid: user.uid, 
                name: user.name,
                email: user.email,
            };

            const result = await usersCollection.insertOne(newUser);
            res.send(result);
        });

        // Get all tasks
        app.get("/tasks", async (req, res) => {
            try {
                const tasks = await tasksCollection.find().toArray();
                res.json(tasks);
            } catch (error) {
                console.error("Error fetching tasks:", error);
                res.status(500).json({ message: "Internal server error" });
            }
        });


        app.get("/tasks/count", async (req, res) => {
            try {
                const tasksCount = await tasksCollection.aggregate([
                    {
                        $group: {
                            _id: "$category",
                            count: { $sum: 1 }
                        }
                    }
                ]).toArray();

                // Convert to a readable object { "To-Do": 3, "In Progress": 5, "Done": 6 }
                const formattedCounts = tasksCount.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {});

                res.json(formattedCounts);
            } catch (error) {
                console.error("Error fetching task counts:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });



        app.put("/taskscategory/:id", async (req, res) => {

            console.log("hitting tasks with ID");
            try {
                const taskId = req.params.id;
                const { category } = req.body;
                const result = await tasksCollection.updateOne(
                    { _id: new ObjectId(taskId) },
                    { $set: { category } }
                );
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: "Failed to update task category" });
            }
        });


        app.post("/tasks", async (req, res) => {
            const { title, description, category } = req.body;

            if (!title || title.length > 50) {
                return res.status(400).json({ message: "Title is required and must be under 50 characters." });
            }
            if (description && description.length > 200) {
                return res.status(400).json({ message: "Description must be under 200 characters." });
            }
            if (!["To-Do", "In Progress", "Done"].includes(category)) {
                return res.status(400).json({ message: "Invalid category." });
            }

            const newTask = {
                title,
                description: description || "",
                timestamp: new Date().toISOString(),
                category,
            };

            try {
                const result = await tasksCollection.insertOne(newTask);
                res.status(201).json({ message: "Task added successfully", task: { ...newTask, _id: result.insertedId } });
            } catch (error) {
                console.error("Error adding task:", error);
                res.status(500).json({ message: "Internal server error" });
            }
        });

        app.put("/alltasks/sort", async (req, res) => {
            try {
                const { category, sortedTasks } = req.body;

                if (!category || !Array.isArray(sortedTasks)) {
                    return res.status(400).json({ error: "Invalid data" });
                }

                console.log("Sorted Tasks:", sortedTasks);

                const bulkOps = sortedTasks.map((task, index) => ({
                    updateOne: {
                        filter: { _id: new ObjectId(task._id) },
                        update: { $set: { order: index } },
                    },
                }));

                const result = await tasksCollection.bulkWrite(bulkOps);
                console.log("Bulk Write Result:", result);

                if (result.modifiedCount === 0) {
                    return res.status(400).json({ error: "No tasks were updated." });
                }

                res.json({ message: `${result.modifiedCount} tasks sorted successfully` });
            } catch (error) {
                console.error("Error sorting tasks:", error);
                res.status(500).json({ error: "Failed to sort tasks" });
            }
        });


        app.delete("/tasks/:id", async (req, res) => {
            const taskId = req.params.id;

            if (!ObjectId.isValid(taskId)) {
                return res.status(400).json({ message: "Invalid task ID" });
            }

            try {
                const result = await tasksCollection.deleteOne({ _id: new ObjectId(taskId) });

                if (result.deletedCount === 1) {
                    res.json({ message: "Task deleted successfully" });
                } else {
                    res.status(404).json({ message: "Task not found" });
                }
            } catch (error) {
                console.error("Error deleting task:", error);
                res.status(500).json({ message: "Internal server error" });
            }
        });


        app.put("/tasksdetails/:id", async (req, res) => {
            const { id } = req.params;
            const { title, description, category } = req.body;

            const result = await tasksCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { title, description, category } }
            );

            console.log("I am now at 176");

            console.log(result.modifiedCount);

            if (result.modifiedCount === 1) {
                res.status(200).json({ message: "Task updated successfully" });
            } else {
                res.status(404).json({ message: "Task not found or no changes made" });
            }
        });

        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send("Task Management Server is Running")
})

app.listen(port, () => {
    console.log(`Task Management Server is running on Port : ${port}`)
})