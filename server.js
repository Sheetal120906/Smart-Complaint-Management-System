const express = require("express");
const path = require("path");

const app = express();

// middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// static files
app.use(express.static("public"));

// EJS setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// route
app.get("/", (req, res) => {
    res.render("student/dashboard", {
        user: { name: "Sheetal" },
        stats: { total: 0, pending: 0, inProgress: 0, resolved: 0 },
        css: "dashboard.css"
    });
});

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});