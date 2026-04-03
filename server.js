const express = require("express");
const path = require("path");
const mysql = require("mysql2");
const db = require("./db");
const session = require("express-session");

const app = express();

// ================== SESSION SETUP ==================
app.use(session({
    secret: "yourSecretKey",  // Replace with a strong secret
    resave: false,
    saveUninitialized: true
}));

// ================== MIDDLEWARE ==================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

// ================== EJS SETUP ==================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ================== ROUTES ==================

// LOGIN PAGE
app.get("/", (req, res) => {
    if (req.session.user) return res.redirect("/dashboard");
    res.render("student/login");
});

app.get("/login", (req, res) => {
    if (req.session.user) return res.redirect("/dashboard");
    res.render("student/login");
});

// REGISTER PAGE
app.get("/register", (req, res) => {
    res.render("student/register");
});

// ================== DASHBOARD ==================
app.get("/dashboard", (req, res) => {
    if (!req.session.user) return res.redirect("/login");

    db.query("SELECT * FROM complaints", (err, complaints) => {
        if (err) throw err;

        // ✅ CALCULATE STATS
        const stats = {
            total: complaints.length,
            pending: complaints.filter(c => c.status === "pending").length,
            inProgress: complaints.filter(c => c.status === "inProgress").length,
            resolved: complaints.filter(c => c.status === "resolved").length
        };

        // ✅ FETCH COMMENTS FOR EACH COMPLAINT
        const promises = complaints.map(c => {
            return new Promise((resolve, reject) => {
                db.query(
                    "SELECT comment_text FROM comments WHERE complaint_id = ?",
                    [c.id],
                    (err, comments) => {
                        if (err) return reject(err);
                        c.commentsList = (comments || []).map(cm => cm.comment_text);
                        resolve();
                    }
                );
            });
        });

        Promise.all(promises)
            .then(() => {
                res.render("student/dashboard", {
                    user: req.session.user,
                    complaints,
                    stats,
                    currentPage: "/dashboard"
                });
            })
            .catch(err => {
                console.log(err);
                res.send("Error loading comments");
            });
    });
});

// ================== ADD COMPLAINT PAGE ==================
app.get("/add-complaints", (req, res) => {
    if (!req.session.user) return res.redirect("/login");

    res.render("student/complain", {
        user: req.session.user
    });
});

// ================== VIEW ALL COMPLAINTS ==================
app.get("/complaints", (req, res) => {
    if (!req.session.user) return res.redirect("/login");

    db.query("SELECT * FROM complaints", (err, complaints) => {
        res.render("student/complaints", {
            complaints,
            user: req.session.user,
            currentPage: "/complaints"
        });
    });
});

// ================== MY COMPLAINTS ==================
app.get("/my-complaints", (req, res) => {
    if (!req.session.user) return res.redirect("/login");

    db.query(
        "SELECT * FROM complaints WHERE student = ?",
        [req.session.user.roll],
        (err, complaints) => {
            if (err) throw err;
            res.render("student/complaints", {
                complaints,
                viewType: "mine",
                user: req.session.user,
                currentPage: "/my-complaints" // ✅ pass currentPage here
            });
        }
    );
});

// ================== MANAGER DASHBOARD ==================
app.get("/manager", (req, res) => {
    if (!req.session.user || req.session.user.role !== "manager") {
        return res.redirect("/login");
    }

    db.query("SELECT * FROM complaints", (err, complaints) => {
        if (err) throw err;

        // For each complaint, fetch comments
        const promises = complaints.map(c => {
            return new Promise((resolve, reject) => {
                db.query(
                    "SELECT comment_text FROM comments WHERE complaint_id = ?",
                    [c.id],
                    (err, comments) => {
                        if (err) return reject(err);

                        // Initialize commentsList even if no comments
                        c.commentsList = comments?.map(cm => cm.comment_text) || [];
                        resolve();
                    }
                );
            });
        });

        Promise.all(promises)
            .then(() => {
                res.render("manager/dashboard", {
                    complaints,
                    user: req.session.user,
                    currentPage: "/manager"
                });
            })
            .catch(err => {
                console.error(err);
                res.send("Error loading complaints with comments");
            });
    });
});
// ================== REGISTER ==================
app.post("/register", (req, res) => {
    const { roll, name, department, year, password } = req.body;

    db.query(
        "INSERT INTO users (roll, name, department, year, password) VALUES (?, ?, ?, ?, ?)",
        [roll, name, department, year, password],
        (err) => {
            if (err) return res.send("User already exists ❌");
            res.redirect("/login");
        }
    );
});

// ================== LOGIN ==================
app.post("/login", (req, res) => {
    const { roll, password, role } = req.body;

    // MANAGEMENT LOGIN
    if (role === "management") {
        if (roll === "admin" && password === "admin123") {
            // Store manager in session
            req.session.user = { name: "Admin", role: "manager" };
            return res.redirect("/manager"); // Redirect to manager dashboard
        } else {
            return res.send("Invalid manager login ❌");
        }
    }

    // STUDENT LOGIN
    db.query(
        "SELECT * FROM users WHERE roll = ? AND password = ?",
        [roll, password],
        (err, result) => {
            if (err) throw err;
            if (result.length === 0) return res.send("Invalid credentials ❌");

            req.session.user = result[0];
            res.redirect("/dashboard");
        }
    );
});

// ================== ADD COMPLAINT ==================
app.post("/add-complaints", (req, res) => {
    if (!req.session.user) return res.redirect("/login");

    const { category, title, description } = req.body;

    db.query(
        "INSERT INTO complaints (category, title, description, student) VALUES (?, ?, ?, ?)",
        [category, title, description, req.session.user.roll],
        (err) => {
            if (err) throw err;
            res.redirect("/complaints");
        }
    );
});

// ================== ADD COMMENT ==================
app.post("/add-comment/:id", (req, res) => {
    if (!req.session.user) return res.status(401).send("Login required ❌");

    const { comment, redirectTo } = req.body;

    db.query(
        "INSERT INTO comments (complaint_id, student, comment_text) VALUES (?, ?, ?)",
        [req.params.id, req.session.user.roll, comment],
        (err) => {
            if (err) throw err;

            db.query(
                "UPDATE complaints SET comments_count = comments_count + 1 WHERE id = ?",
                [req.params.id],
                () => {
                    res.redirect(redirectTo);
                }
            );
        }
    );
});

// ================== VOTE (AGREE) ==================
app.post("/agree/:id", (req, res) => {
    if (!req.session.user) return res.status(401).send("Login required ❌");

    const complaintId = req.params.id;
    const userRoll = req.session.user.roll;
    const redirectTo = req.body.redirectTo;

    db.query(
        "SELECT * FROM votes WHERE complaint_id = ? AND user_roll = ?",
        [complaintId, userRoll],
        (err, result) => {
            if (err) throw err;

            if (result.length === 0) {
                db.query(
                    "INSERT INTO votes (complaint_id, user_roll, vote_type) VALUES (?, ?, 'agree')",
                    [complaintId, userRoll],
                    () => {
                        db.query(
                            "UPDATE complaints SET agree = agree + 1 WHERE id = ?",
                            [complaintId],
                            () => res.redirect(redirectTo)
                        );
                    }
                );
            } else {
                const previousVote = result[0].vote_type;
                if (previousVote === "agree") return res.redirect(redirectTo);

                db.query(
                    "UPDATE votes SET vote_type = 'agree' WHERE complaint_id = ? AND user_roll = ?",
                    [complaintId, userRoll],
                    () => {
                        db.query(
                            "UPDATE complaints SET agree = agree + 1, disagree = disagree - 1 WHERE id = ?",
                            [complaintId],
                            () => res.redirect(redirectTo)
                        );
                    }
                );
            }
        }
    );
});

// ================== VOTE (DISAGREE) ==================
app.post("/disagree/:id", (req, res) => {
    if (!req.session.user) return res.status(401).send("Login required ❌");

    const complaintId = req.params.id;
    const userRoll = req.session.user.roll;
    const redirectTo = req.body.redirectTo;

    db.query(
        "SELECT * FROM votes WHERE complaint_id = ? AND user_roll = ?",
        [complaintId, userRoll],
        (err, result) => {
            if (err) throw err;

            if (result.length === 0) {
                db.query(
                    "INSERT INTO votes (complaint_id, user_roll, vote_type) VALUES (?, ?, 'disagree')",
                    [complaintId, userRoll],
                    () => {
                        db.query(
                            "UPDATE complaints SET disagree = disagree + 1 WHERE id = ?",
                            [complaintId],
                            () => res.redirect(redirectTo)
                        );
                    }
                );
            } else {
                const previousVote = result[0].vote_type;
                if (previousVote === "disagree") return res.redirect(redirectTo);

                db.query(
                    "UPDATE votes SET vote_type = 'disagree' WHERE complaint_id = ? AND user_roll = ?",
                    [complaintId, userRoll],
                    () => {
                        db.query(
                            "UPDATE complaints SET disagree = disagree + 1, agree = agree - 1 WHERE id = ?",
                            [complaintId],
                            () => res.redirect(redirectTo)
                        );
                    }
                );
            }
        }
    );
});

// ================== DELETE COMPLAINT ==================
app.post("/delete-complaint/:id", (req, res) => {
    if (!req.session.user) return res.redirect("/login");

    const complaintId = Number(req.params.id);

    db.query(
        "SELECT * FROM complaints WHERE id = ?",
        [complaintId],
        (err, result) => {
            if (err) throw err;

            if (result.length === 0) return res.send("Complaint not found ❌");

            const complaint = result[0];

            if (req.session.user.role !== "manager" && complaint.student !== req.session.user.roll) {
                return res.send("Unauthorized ❌ You can delete only your complaint");
            }

            db.query(
                "DELETE FROM complaints WHERE id = ?",
                [complaintId],
                (err) => {
                    if (err) throw err;

                    if (req.session.user.role === "manager") {
                        res.redirect("/manager");
                    } else {
                        res.redirect("/dashboard");
                    }
                }
            );
        }
    );
});

app.post("/update-complaint-status/:id", (req, res) => {
    if (!req.session.user || req.session.user.role !== "manager") return res.redirect("/login");

    const complaintId = req.params.id;
    const { status, response } = req.body;

    db.query(
        "UPDATE complaints SET status = ?, response = ? WHERE id = ?",
        [status, response, complaintId],
        (err) => {
            if (err) throw err;
            res.redirect("/manager");
        }
    );
});

// ================== LOGOUT ==================
app.post("/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) throw err;
        res.redirect("/login");
    });
});

// ================== SERVER ==================
app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});