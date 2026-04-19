# Smart-Complaint-Management-System
The Complaint & Feedback Management System is a full-stack web application designed to efficiently manage user complaints and feedback in an organized manner. It allows users to submit complaints and feedback, while administrators can track, manage, and resolve them through a centralized dashboard.

This system improves communication between users and administrators and ensures faster issue resolution.

🔗 Live Website: https://smart-complaint-management-system-d3sl.onrender.com

🚀 Features
👤 User Module
User registration and login system
Submit complaints with category and description
Submit feedback and suggestions
View status of complaints (Pending / In Progress / Resolved)
Track submitted complaints and feedback history

🛠️ Admin Module
Secure admin login
View all complaints and feedback
Filter complaints by category and status
Update complaint status
send and Review user feedback

🧰 Tech Stack
Frontend: HTML, CSS, JavaScript, EJS
Backend: Node.js, Express.js
Database: MySQL
Other Tools: dotenv, npm, Git, VS Code

📁 Project Structure
SMART-COMPLAINT-MANAGEMENT-SYSTEM/
│
├── images/        # Icons, screenshots, assets
├── public/        # CSS, JS, frontend files
├── views/         # EJS templates
│
├── db.js          # Database connection
├── server.js      # Main backend server
├── dump.sql       # Database schema/data
├── package.json   # Dependencies
├── .gitignore
└── README.md

⚙️ Installation & Setup
1. Clone Repository
git clone https://github.com/your-username/Smart-Complaint-Management-System.git
2. Move to project folder
cd Smart-Complaint-Management-System
3. Install dependencies
npm install
4. Configure environment variables

Create a .env file:

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=your_database
PORT=3000

5. Import database
Open MySQL
Import dump.sql

7. Run the server
node server.js

9. Open in browser
http://localhost:3000

🔮 Future Improvements
Email notifications for complaint updates
Real-time chat between user and admin
File/image upload for complaints
Analytics dashboard (complaint trends)
Mobile responsive UI improvements
Role-based authentication (Admin/User/Staff)

👨‍💻 Author
Sheetal Nimbarte
B.Tech Computer Science Student

If you like this project, give it a ⭐ on GitHub and feel free to contribute or improve it!
