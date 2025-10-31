## 🌏 SynapTalk - Next-Generation Real-Time Communication Platform
</br>
<p align="center">
  🌴🎄🌳🌲 ⭐💖 - 🌍🌎🌏 - 💖⭐ 🌲🌳🎄🌴
</p>
</br>
SynapTalk 🌐 is a next-generation platform that unifies real-time chat, HD video calls, screen sharing, AI-powered assistance, and social media management — all in one place.</br>
Built with end-to-end encryption, low-latency infrastructure, and modern web technologies, it ensures fast, secure, and seamless communication for users.

## ✨ Features :
✅ 1:1 & Group Chat – Real-time text/image messaging with typing indicators and read receipts.</br>
✅ Video Calls – Seamless peer-to-peer calling with WebRTC integration.</br>
✅ Online Presence – Realtime user status (online/offline) tracking.</br>
✅ AI Assistant — Responds only when tagged, offering smart, context-aware replies while keeping chats fully end-to-end encrypted.</br>
✅ User Authentication – Secure JWT-based authentication stored in localStorage, enabling persistent sessions and fast client-side access.</br>
✅End-to-End Encryption – Implements secure communication using a hybrid encryption model with ECC key exchange and AES symmetric encryption, ensuring messages are encrypted and decrypted only by the sender and recipient.</br>
✅ Screen Share — Share your screen in real time during video calls for seamless collaboration.</br>
✅ Dynamic Group Management – Create, Add, and manage groups all functionalities.</br>
✅ Login with Google (OAuth 2.0) — Sign-in via Google using OAuth2.</br>
✅ Google Contacts Sync & Invite Flow — Sync Google Contacts (with consent) and invite up to 20+ contacts to speed onboarding.</br>
✅ Social Media Integration – Manage your all social media accounts.</br>
✅ Scalable Architecture – Modular design with Socket.IO and REST APIs for seamless performance.</br>
✅ Observability & Monitoring — Server-side metrics, error tracking, and logs for production readiness.</br>

</br>

## 📸 Screenshots :

</br>

## 🧩 Tech Stack :

**💻 Frontend**
</br>
React.js (Vite) – Core framework for building a modular, reactive, and high-performance UI.</br>
Tailwind CSS – Utility-first CSS framework enabling rapid and responsive design customization.</br>
Redux Toolkit / Context API – Manages global app state efficiently across chat, call, and AI modules.</br>
React Router DOM – Handles dynamic routing and authenticated route protection.</br>
Socket.IO Client – Enables real-time communication for instant message delivery and user presence.</br>
WebRTC + getDisplayMedia() – Powers HD peer-to-peer video calls and real-time screen sharing.</br>
Axios – Simplifies API requests and server communication with error handling.</br>
LocalStorage – Stores session and chat cache securely on the client for faster reloads.</br>
Google OAuth 2.0 (PKCE) – Allows secure and smooth one-click login via Google.</br>
Push API + Toast Notifications – Delivers real-time alerts for new messages, calls, and system events.</br>
Vercel – Used for deployment and CDN-based frontend delivery.</br>
</br>
**⚙️ Backend**
</br>
Node.js + Express.js – Backend framework for handling RESTful APIs, sockets, and signaling logic.</br>
MongoDB + Mongoose – NoSQL database managing users, chats, calls, and encrypted messages.</br>
Socket.IO Server – Maintains real-time connections for chat, calls, and user status updates.</br>
WebRTC Signaling Server – Facilitates peer-to-peer connection setup for audio, video, and screen sharing.</br>
ECC + AES Encryption – Ensures end-to-end encryption through hybrid cryptography (secure key exchange + symmetric message encryption).</br>
JWT Authentication – Provides secure, stateless user sessions.</br>
Google OAuth 2.0 API – Enables secure third-party authentication via Google Sign-In.</br>
Google Contacts API – Fetches and syncs user contacts for in-app invitations.</br>
Cloudinary – Handles image, file, and media uploads with CDN caching.</br>
Gemini API – Integrates AI assistant (@saras inspired from Devi Saraswati ) for smart, contextual chat responses.</br>
Render – Production-grade backend hosting with scalability and monitoring support.</br>
</br>

## ⚙️ Installation :
</br>
Follow these steps to set up the project locally 👇</br>
</br>
1️⃣ Clone the Repository</br>
git clone https://github.com/RohitChavan16/SynapTalk.git</br>
cd SynapTalk</br>
</br>

  🌴🎄🌳🌲⭐💖 - Backend Setup - 💖⭐🌲🌳🎄🌴
</br></br>
cd server</br>
npm install</br>

</br>
Create a .env file in the server folder and add the following:
MONGODB_URI=</br>
PORT=</br>
JWT_SECRET=</br>
CLIENT_URL=</br>

CLOUDINARY_CLOUD_NAME=</br>
CLOUDINARY_API_KEY=</br>
CLOUDINARY_API_SECRET=</br>
</br>
SMTP_USER</br>
SMTP_PASS=</br>
SENDER_EMAIL=</br>

GOOGLE_CLIENT_ID=</br>
GOOGLE_CLIENT_SECRET=</br>
GOOGLE_REDIRECT_URI=</br>

SESSION_SECRET=</br>
GEMINI_API_KEY=
</br></br>
Then start the server:</br>
npm run dev</br>
</br>


  🌴🎄🌳🌲⭐💖 - Frontend Setup - 💖⭐🌲🌳🎄🌴


</br></br>
cd client</br>
npm install</br>

</br>
Create a .env file in the client folder:
VITE_BACKEND_URL=
VITE_CURRENCY='₹'
VITE_TMDB_IMAGE_BASE_URL=
</br></br>

Then run:</br>
npm run dev</br></br>

  🌴🎄🌳🌲⭐💖 - Open the web - 💖⭐🌲🌳🎄🌴

</br>
Frontend: http://localhost:5173</br>
Backend: http://localhost:5001 (or your PORT)</br>
</br>







## 💡 Future Enhancements :




## 🧑‍💻 Author
**Rohit Chavan**  
[GitHub](https://github.com/RohitChavan16) | [LinkedIn](https://linkedin.com/in/rohit-chavan16)  
✨ Jai Shri Ram ✨
