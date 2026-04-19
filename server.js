const express = require("express");
const path = require("path");
const mysql = require("mysql2");
const db = require("./db");
const session = require("express-session");

// 🔥 ADD THIS
const MySQLStore = require("express-mysql-session")(session);

const app = express();

// ================== SESSION STORE ==================
const sessionStore = new MySQLStore({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});

// ================== SESSION SETUP ==================
app.use(session({
    key: "session_cookie_name",
    secret: process.env.SESSION_SECRET || "yourSecretKey",
    store: sessionStore,            
    resave: false,
    saveUninitialized: false         
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

        //  CALCULATE STATS
        const stats = {
            total: complaints.length,
            pending: complaints.filter(c => c.status === "pending").length,
            inProgress: complaints.filter(c => c.status === "inProgress").length,
            resolved: complaints.filter(c => c.status === "resolved").length
        };

        //  FETCH COMMENTS FOR EACH COMPLAINT
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
                currentPage: "/my-complaints" // pass currentPage here
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

app.get("/manager/complain", (req, res) => {
    if (!req.session.user || req.session.user.role !== "manager") {
        return res.redirect("/login");
    }

    db.query("SELECT * FROM complaints", (err, complaints) => {
        if (err) throw err;

        if (complaints.length === 0) {
            return res.render("manager/complain", {
                complaints: [],
                user: req.session.user,
                currentPage: "/manager/complain"
            });
        }

        let count = 0;

        complaints.forEach(c => {
            db.query(
                "SELECT comment_text FROM comments WHERE complaint_id = ?",
                [c.id],
                (err, comments) => {

                    c.commentsList = (comments || []).map(cm => cm.comment_text);

                    count++;

                    if (count === complaints.length) {
                        res.render("manager/complain", {
                            complaints,              //  FIXED
                            user: req.session.user,
                            currentPage: "/manager/complain"
                        });
                    }
                }
            );
        });
    });
});

// Show all polls
app.get("/feedback", (req, res) => {
    if (!req.session.user) return res.redirect("/login");

    db.query(`
        SELECT 
            p.*,
            IFNULL(AVG(r.rating), 0) AS avg,
            COUNT(r.id) AS total
        FROM polls p
        LEFT JOIN ratings r ON p.id = r.poll_id
        GROUP BY p.id
    `, (err, polls) => {

        if (err) throw err;

        res.render("manager/feedback", {
            polls,
            showForm: false,
            user: req.session.user
        });
    });
});

app.get("/create-poll", (req, res) => {
    if (!req.session.user) return res.redirect("/login");

    res.render("manager/feedback", {
        polls: [],
        showForm: true,
        user: req.session.user   // IMPORTANT
    });
});
// Create poll
app.post("/create-poll", (req, res) => {
    if (!req.session.user || req.session.user.role !== "manager") {
        return res.redirect("/login");
    }

    const { title, description, category } = req.body;

    if (!title || !description) {
        return res.send("Title and Description are required");
    }

    db.query(
        "INSERT INTO polls (title, description, category) VALUES (?, ?, ?)",
        [title, description, category],
        (err) => {
            if (err) {
                console.log(err);
                return res.send("Database error");
            }
            res.redirect("/feedback");
        }
    );
});
// ================== REGISTER ==================
app.post("/register", (req, res) => {
    const { roll, name, department, year, password } = req.body;

    db.query(
        "INSERT INTO users (roll, name, department, year, password) VALUES (?, ?, ?, ?, ?)",
        [roll, name, department, year, password],
        (err) => {
            if (err) return res.send("User already exists ");
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
            return res.send("Invalid manager login ");
        }
    }

    // STUDENT LOGIN
    db.query(
        "SELECT * FROM users WHERE roll = ? AND password = ?",
        [roll, password],
        (err, result) => {
            if (err) throw err;
            if (result.length === 0) return res.send("Invalid credentials ");

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
    if (!req.session.user) return res.status(401).send("Login required ");

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
    if (!req.session.user) return res.status(401).send("Login required ");

    const complaintId = req.params.id;
    const userRoll = req.session.user.roll;
    const redirectTo = req.body.redirectTo;

    db.query(
        "SELECT * FROM votes WHERE complaint_id = ? AND user_roll = ?",
        [complaintId, userRoll],
        (err, result) => {
            if (err) throw err;

            if (result.length === 0) {
                // First vote
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
                const prev = result[0].vote_type;

                if (prev === "agree") return res.redirect(redirectTo);

                db.query(
                    "UPDATE votes SET vote_type = 'agree' WHERE complaint_id = ? AND user_roll = ?",
                    [complaintId, userRoll],
                    () => {
                        db.query(
                            "UPDATE complaints SET agree = agree + 1, disagree = GREATEST(disagree - 1,0) WHERE id = ?",
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
    if (!req.session.user) return res.status(401).send("Login required ");

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
                const prev = result[0].vote_type;

                if (prev === "disagree") return res.redirect(redirectTo);

                db.query(
                    "UPDATE votes SET vote_type = 'disagree' WHERE complaint_id = ? AND user_roll = ?",
                    [complaintId, userRoll],
                    () => {
                        db.query(
                            "UPDATE complaints SET disagree = disagree + 1, agree = GREATEST(agree - 1,0) WHERE id = ?",
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

            if (result.length === 0) return res.send("Complaint not found ");

            const complaint = result[0];

            //  Permission check
            if (
                req.session.user.role !== "manager" &&
                complaint.student !== req.session.user.roll
            ) {
                return res.send("Unauthorized ");
            }

            db.query(
                "DELETE FROM complaints WHERE id = ?",
                [complaintId],
                (err) => {
                    if (err) throw err;

                    res.redirect(
                        req.session.user.role === "manager"
                            ? "/manager/dashboard"
                            : "/dashboard"
                    );
                }
            );
        }
    );
});
app.post("/update-complaint-status/:id", (req, res) => {
    console.log("ROUTE HIT");
    console.log("BODY:", req.body);

    const { status, response } = req.body;

    db.query(
        "UPDATE complaints SET status = ?, response = ? WHERE id = ?",
        [status, response, req.params.id],
        (err) => {
            if (err) {
                console.log(" DB ERROR FULL:", err);
                return res.send(err.sqlMessage); //  SHOW ACTUAL ERROR
            }

            res.redirect("/manager/complain");
        }
    );
});

//============ FEEDBACK SYSTEM =============================
app.get("/student/feedback", (req, res) => {
    if (!req.session.user) return res.redirect("/login");

    const student = req.session.user.roll;

    db.query(`
        SELECT p.*, r.rating, r.comment
        FROM polls p
        LEFT JOIN ratings r 
        ON p.id = r.poll_id AND r.student = ?
        WHERE p.is_active = 1
    `, [student], (err, polls) => {

        if (err) {
            console.log(err);
            return res.send("DB Error");
        }
        
        res.render("student/feedback", {
            polls,
            user: req.session.user
        });
    });
});

app.post("/submit-rating/:id", (req, res) => {
    if (!req.session.user) return res.redirect("/login");

    const pollId = req.params.id;
    const student = req.session.user.roll;
    const { rating, comment } = req.body;

    if (!rating) return res.send("Please select rating");

    //  CHECK if already exists
    db.query(
        "SELECT * FROM ratings WHERE poll_id = ? AND student = ?",
        [pollId, student],
        (err, result) => {
            if (err) {
                console.log(err);
                return res.send("DB Error");
            }

            if (result.length > 0) {
                // UPDATE
                db.query(
                    "UPDATE ratings SET rating = ?, comment = ? WHERE poll_id = ? AND student = ?",
                    [rating, comment, pollId, student],
                    (err2) => {
                        if (err2) {
                            console.log(err2);
                            return res.send("Update Error");
                        }
                        res.redirect("/student/feedback");
                    }
                );
            } else {
                // ➕ INSERT
                db.query(
                    "INSERT INTO ratings (poll_id, student, rating, comment) VALUES (?, ?, ?, ?)",
                    [pollId, student, rating, comment],
                    (err3) => {
                        if (err3) {
                            console.log(err3);
                            return res.send("Insert Error");
                        }
                        res.redirect("/student/feedback");
                    }
                );
            }
        }
    );
});

app.get("/poll-results/:id", (req, res) => {
    const pollId = req.params.id;

    db.query(
        "SELECT AVG(rating) as avg, COUNT(*) as total FROM ratings WHERE poll_id = ?",
        [pollId],
        (err, stats) => {

            if (err) {
                console.error("Stats Error:", err);
                return res.status(500).json({ error: "DB error in stats" });
            }

            let avg = stats?.[0]?.avg || 0;
            let total = stats?.[0]?.total || 0;

            db.query(
                "SELECT rating, COUNT(*) as count FROM ratings WHERE poll_id = ? GROUP BY rating",
                [pollId],
                (err2, dist) => {

                    if (err2) {
                        console.error("Distribution Error:", err2);
                        return res.status(500).json({ error: "DB error in distribution" });
                    }

                    let distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
                    dist.forEach(d => {
                        distribution[d.rating] = d.count;
                    });

                    db.query(
                        "SELECT student, rating, comment FROM ratings WHERE poll_id = ? ORDER BY created_at DESC",
                        [pollId],
                        (err3, feedback) => {

                            if (err3) {
                                console.error("Feedback Error:", err3);
                                return res.status(500).json({ error: "DB error in feedback" });
                            }

                            const result = {
                                avg,
                                total,
                                distribution,
                                feedback
                            };

                            console.log("API DATA:", result);

                            res.json(result);
                        }
                    );
                }
            );
        }
    );
});

app.post("/delete-poll/:id", (req, res) => {
    db.query("DELETE FROM polls WHERE id = ?", [req.params.id], () => {
        res.redirect("/feedback");
    });
});

app.post("/deactivate-poll/:id", (req, res) => {
    db.query(
        "UPDATE polls SET is_active = 0 WHERE id = ?",
        [req.params.id],
        () => res.redirect("/feedback")
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
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});