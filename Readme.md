# 📊 Expense Tracker

A powerful, privacy-first, and feature-rich Progressive Web App (PWA) to track your daily expenses, manage budgets, and achieve your savings goals. 

🌐 **Live Demo:** [personalexpe.netlify.app](https://personalexpe.netlify.app)

---

## ✨ Features

- **📱 Progressive Web App (PWA):** Installable on iOS, Android, and Desktop directly from the browser.
- **☁️ Cloud Sync (Firebase):** Create an account to sync your data instantly across all your devices, or use it 100% offline via local storage.
- **🤖 Smart Auto-Fill:** Paste your bank transaction SMS and let the app automatically extract the amount, guess the category, and fill the form.
- **💱 Multi-Currency Support:** Enter expenses in USD, EUR, or GBP, and see them automatically converted to your base currency (INR).
- **🧾 Receipt Attachments:** Snap or upload a photo of your receipt and attach it directly to the expense.
- **✂️ Split Bills:** Easily track shared expenses and see exactly who owes you what.
- **🎯 Advanced Budgeting:** Set a global monthly budget and specific **category budget caps** to get warnings before you overspend.
- **🔁 Recurring Expenses:** Mark an expense as monthly, and it will auto-add itself on the 1st of every month.
- **🎨 Custom Categories:** Create your own categories with custom emojis and color tags.
- **📈 Beautiful Analytics:** Visualize your spending with interactive donut charts and 6-month trend bar charts.
- **📥 CSV Import & Export:** Bulk import your bank statements or export your data for Excel.
- **🌓 Dark/Light Mode:** Toggle between beautiful dark and light themes.

---

## 🛠️ Tech Stack

- **Frontend:** HTML5, CSS3 (Vanilla), JavaScript (ES6+)
- **Charts:** [Chart.js](https://www.chartjs.org/)
- **Backend & Database:** Google Firebase (Authentication & Firestore)
- **Deployment:** Netlify

---

## 🚀 Running Locally

If you want to run or modify this project on your local machine, follow these steps:

### 1. Clone the repository
```bash
git clone https://https://github.com/Yashaswini-S-Dongre/expense-tracker
cd expense-tracker
```

### 2. Configure Firebase (Optional but recommended for Cloud Sync)
To enable cloud syncing, you need to add your own Firebase credentials.

1. Create a free project at Firebase Console.
2. Enable **Email/Password Authentication** and **Firestore Database** (Start in Test Mode).
3. Register a Web App in Firebase to get your config keys.
4. Open `script.js` and replace the `firebaseConfig` object at the very top with your own keys:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 3. Launch the App
Since this is a static web application, no build steps or Node modules are required. Simply open the `index.html` file in any modern web browser. 

Alternatively, use a local server like VS Code's Live Server extension.

## 📱 How to Install on Phone
1. Open the Live URL in your mobile browser (Chrome for Android, Safari for iOS).
2. **Android:** A prompt will appear at the bottom asking to "Add to Home Screen". Tap it.
3. **iOS:** Tap the "Share" icon at the bottom of Safari, scroll down, and tap "Add to Home Screen".

The app will now appear on your phone's home screen with a native app icon and no browser search bar!

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the issues page.

## 📝 License
This project is open-source and available under the MIT License.
