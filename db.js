const mysql = require("mysql2");

const db = require("mysql2").createConnection({
    host: "localhost",
    user: "root",
    password: "Savn@60029021",   //  EXACT same password you entered in terminal
    database: "complain_system"
});

db.connect((err) => {
    if (err) {
        console.log(" DB ERROR:", err.message);
    } else {
        console.log("MySQL Connected ");
    }
});

module.exports = db;