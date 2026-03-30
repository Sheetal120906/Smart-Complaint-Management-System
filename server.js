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
    complaints: complaints,   // ✅ REQUIRED
    stats: {
        total: complaints.length,
        pending: complaints.filter(c => c.status === "pending").length,
        inProgress: complaints.filter(c => c.status === "inProgress").length,
        resolved: complaints.filter(c => c.status === "resolved").length
    }
   });
});

// COMPLAINT PAGE (Protected)
app.get("/add-complaints", (req, res) => {
    if (!currentUser) return res.redirect("/login");

    res.render("student/complain", {
        user: currentUser
    });
});


app.get("/manager", (req, res) => {
    if (!currentUser || currentUser.role !== "manager") {
        return res.redirect("/");
    }

    res.render("manager/dashboard", {
        complaints,
        stats: {
            total: complaints.length,
            pending: complaints.filter(c => c.status === "pending").length,
            inProgress: complaints.filter(c => c.status === "inProgress").length,
            resolved: complaints.filter(c => c.status === "resolved").length
        }
    });
});

app.get("/complaints", (req, res) => {
    if (!currentUser) return res.redirect("/login");

    res.render("student/complaints", {
        complaints,
        user: currentUser
    });
});

// ================== FORM HANDLING ==================

// REGISTER
app.post("/register", (req, res) => {
    const { roll, name, department, year, password, confirmPassword } = req.body;

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
    const { roll, password, role } = req.body; // ✅ FIXED

    // ================= MANAGER LOGIN =================
    if (role === "management") {
        if (roll === "admin" && password === "admin123") { // ✅ FIXED (roll instead of email)
            currentUser = { name: "Admin", role: "manager" };
            return res.redirect("/manager");
        } else {
            return res.send("Invalid manager login ❌");
        }
    }

    // ================= STUDENT LOGIN =================
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
app.post("/add-complaints", (req, res) => {
    if (!currentUser) return res.redirect("/login");

    const { category, title, description } = req.body;

    const newComplaint = {
    id: Date.now(),
    category,
    title,
    description,
    status: "pending",
    date: new Date().toLocaleDateString(),
    student: currentUser.roll,
    agree: 0,
    disagree: 0,
    comments_count: 0,   
    commentsList: []     // for storing comments
};

    complaints.push(newComplaint);

    console.log("Complaint Added:", newComplaint);

    res.redirect("/complaints");
});

// LOGOUT
app.get("/logout", (req, res) => {
    currentUser = null;
    res.redirect("/login");
});

app.post("/update-status", (req, res) => {
    const { index, status } = req.body;

    complaints[index].status = status;

    res.redirect("/manager");
});

app.post("/delete-complaint", (req, res) => {
    const { index } = req.body;

    complaints.splice(index, 1);

    res.redirect("/manager");
});

app.get("/update-status/:id", (req, res) => {
    if (!currentUser) return res.redirect("/");

    const complaint = complaints.find(c => c.id == req.params.id);

    res.render("manager/update", { complaint });
});

app.post("/update-status/:id", (req, res) => {
    const { status, response } = req.body;

    const complaint = complaints.find(c => c.id == req.params.id);

    if (complaint) {
        complaint.status = status;
        complaint.response = response;
    }

    res.redirect("/complaints");
});

app.post("/add-comment/:id", (req, res) => {
    const complaint = complaints.find(c => c.id == req.params.id);

    if (!complaint) return res.send("Not found");

    complaint.commentsList.push(req.body.comment);
    complaint.comments_count++; // ✅ IMPORTANT

    res.redirect("/complaints"); // or "/dashboard"
});
// ================== SERVER ==================
app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});