// Import required modules
const express = require('express');
const fs = require('fs');
const session = require('express-session');
const app = express();
const PORT = 3000;

// Middleware to parse the body of POST requests
app.use(express.urlencoded({ extended: true })); // For URL-encoded data (HTML forms)
app.use(express.json()); // For JSON bodies (API clients)

// Set up session management with express-session
app.use(session({
    secret: 'yourSecretKey', // Use a real secret in production
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true, // Limits access to the cookie from client-side scripts
        secure: false, // Should be set to true over HTTPS in production
        maxAge: 1000 * 60 * 60 * 24 // Set cookie expiration to 24 hours
    }
}));

// Paths to the data files
const loginFilePath = './login.txt';
const petsFilePath = './pets.txt';

// Function to determine the next pet ID by reading the pets file
function getNextPetId(petsData) {
    const pets = petsData.split(/\r?\n/).filter(line => line);
    return pets.length + 1;
}

// Route to register a new user
app.post('/register', (req, res) => {
    const { username, password } = req.body;

    // Validate presence of username and password
    if (!username || !password) {
        return res.status(400).send("Username and password are required.");
    }

    // Regex to validate username and password formats
    const usernameRegex = /^[A-Za-z0-9]+$/;
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{4,}$/;

    if (!usernameRegex.test(username) || !passwordRegex.test(password)) {
        return res.status(400).send("Invalid username or password format.");
    }

    // Read the login file to check if username exists
    fs.readFile(loginFilePath, 'utf-8', (err, data) => {
        if (err && err.code === 'ENOENT') {
            // File not found, create it and write the new user
            fs.writeFile(loginFilePath, `${username}:${password}\n`, err => {
                if (err) {
                    return res.status(500).send("Error registering user.");
                }
                return res.status(201).send("User registered successfully.");
            });
        } else if (err) {
            return res.status(500).send("Error reading login file.");
        } else {
            const users = data.split(/\r?\n/);
            const exists = users.some(record => record.split(':')[0] === username);

            if (exists) {
                return res.status(409).send("Username already exists, please choose another.");
            } else {
                // Append the new user
                fs.appendFile(loginFilePath, `${username}:${password}\n`, err => {
                    if (err) {
                        return res.status(500).send("Error registering user.");
                    }
                    return res.status(201).send("User registered successfully.");
                });
            }
        }
    });
});

// Route to log in a user
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Validate presence of username and password
    if (!username || !password) {
        return res.status(400).send("Username and password are required.");
    }

    // Read the login file and search for a matching user record
    fs.readFile(loginFilePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).send("Error reading login file.");
        }
        const userRecord = data.split(/\r?\n/).find(record => record === `${username}:${password}`);

        if (userRecord) {
            req.session.userId = username; // Create a session
            res.send("Login successful.");
        } else {
            res.status(401).send("Login failed. Invalid username or password.");
        }
    });
});

// Route to register a new pet
app.post('/register-pet', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).send('You must be logged in to register a pet.');
    }

    const { petType, breed, age, gender, compatibility, comments } = req.body;

    fs.readFile(petsFilePath, 'utf8', (err, data) => {
        let nextId;
        if (err && err.code !== 'ENOENT') {
            return res.status(500).send('Error reading pets file.');
        }
        nextId = err && err.code === 'ENOENT' ? 1 : getNextPetId(data); // Set to 1 if file doesn't exist

        const newPetEntry = `${nextId}:${req.session.userId}:${petType}:${breed}:${age}:${gender}:${compatibility}:${comments}\n`;

        fs.appendFile(petsFilePath, newPetEntry, 'utf8', err => {
            if (err) {
                return res.status(500).send('Error registering pet.');
            }
            res.send(`Pet registered successfully with ID ${nextId}`); // Send success response
        });
    });
});

// Route to handle user logout
app.get('/logout', (req, res) => {
    if (req.session.userId) {
        req.session.destroy(err => {
            if (err) {
                return res.status(500).send('Could not log out, please try again.');
            }
            if (req.cookies['connect.sid']) {
                res.clearCookie('connect.sid'); // Clear session cookie
            }
            res.send("You have been logged out successfully.");
        });
    } else {
        res.status(200).send("No user session found."); // No session found
    }
});

// Start the server and listen on the specified port
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
})