const express = require("express");
const path = require("path");

const app = express();

// ================== MIDDLEWARE ==================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

// ================== EJS SETUP ==================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ================== TEMP DATABASE ==================
let users = [];
let complaints = [];
let currentUser = null; // track logged-in user

// ================== ROUTES ==================

// LOGIN PAGE
app.get("/", (req, res) => {
    if (currentUser) return res.redirect("/dashboard");
    res.render("student/login");
});

app.get("/login", (req, res) => {
    if (currentUser) return res.redirect("/dashboard");
    res.render("student/login");
});

// REGISTER PAGE
app.get("/register", (req, res) => {
    res.render("student/register");
});

// DASHBOARD (Protected)
app.get("/dashboard", (req, res) => {
    if (!currentUser) return res.redirect("/login");

    res.render("student/dashboard", {
        user: currentUser,
        stats: {
            total: complaints.length,
            pending: complaints.filter(c => c.status === "pending").length,
            inProgress: complaints.filter(c => c.status === "inProgress").length,
            resolved: complaints.filter(c => c.status === "resolved").length
        }
    });
});

// COMPLAINT PAGE (Protected)
app.get("/complaints", (req, res) => {
    if (!currentUser) return res.redirect("/login");

    res.render("student/complain", {
        complaints,
        user: currentUser
    });
});

// ================== FORM HANDLING ==================

// REGISTER
app.post("/register", (req, res) => {
    const { roll, name, department, year, password } = req.body;

    const existingUser = users.find(u => u.roll === roll);

    if (existingUser) {
        return res.send("User already exists ❌");
    }
     if (password !== confirmPassword) {
        return res.send("Passwords do not match ❌");
    }
    const newUser = { roll, name, department, year, password };
    users.push(newUser);

    console.log("Registered:", newUser);

    res.redirect("/login");
});

// LOGIN
app.post("/login", (req, res) => {
    const { roll, password } = req.body;

    const foundUser = users.find(
        user => user.roll === roll && user.password === password
    );

    if (!foundUser) {
        return res.send("Invalid credentials ❌");
    }

    currentUser = foundUser;

    console.log("Login success:", foundUser);

    res.redirect("/dashboard");
});

// ADD COMPLAINT
app.post("/complaints", (req, res) => {
    if (!currentUser) return res.redirect("/login");

    const { category, title, description } = req.body;

    const newComplaint = {
        category,
        title,
        description,
        status: "pending",
        date: new Date().toLocaleDateString(),
        student: currentUser.roll
    };

    complaints.push(newComplaint);

    console.log("Complaint Added:", newComplaint);

    res.redirect("/dashboard");
});

// LOGOUT
app.get("/logout", (req, res) => {
    currentUser = null;
    res.redirect("/login");
});

// ================== SERVER ==================
app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});