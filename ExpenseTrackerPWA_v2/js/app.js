import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, addDoc, deleteDoc, serverTimestamp, orderBy } from 'firebase/firestore';

// Global variables provided by the Canvas environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
// FIX: Corrected typo from __initialAuthToken to __initial_auth_token
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Initialize Firebase outside the component to avoid re-initialization
let app;
let db;
let auth;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
} catch (error) {
  console.error("Error initializing Firebase:", error);
  // Handle the error, e.g., display a message to the user
}

const App = () => {
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  // Function to show a custom modal message
  const showCustomModal = (message) => {
    setModalMessage(message);
    setShowModal(true);
  };

  // Effect for Firebase Authentication
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        // Sign in anonymously if no initial auth token is provided or user is not signed in
        try {
          if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
          } else {
            await signInAnonymously(auth);
          }
          setUserId(auth.currentUser?.uid || crypto.randomUUID()); // Fallback to random UUID if anonymous user ID is not immediately available
        } catch (error) {
          console.error("Error during anonymous sign-in:", error);
          setError("Failed to authenticate. Some features may not work.");
          setUserId(crypto.randomUUID()); // Use a random ID if auth fails completely
        }
      }
      setIsAuthReady(true);
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []); // Run only once on component mount

  // Effect for fetching expenses from Firestore
  useEffect(() => {
    if (!isAuthReady || !userId) {
      return; // Wait for authentication to be ready
    }

    const expensesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/expenses`);
    // Order by timestamp to get the latest expenses first
    const q = query(expensesCollectionRef, orderBy('timestamp', 'desc'));

    const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
      const fetchedExpenses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setExpenses(fetchedExpenses);
    }, (err) => {
      console.error("Error fetching expenses:", err);
      setError("Failed to load expenses. Please try again.");
    });

    return () => unsubscribeSnapshot();
  }, [isAuthReady, userId]); // Re-run when auth state or userId changes

  // Register the service worker
  useEffect(() => {
    // Check if Service Workers are supported by the browser
    if ('serviceWorker' in navigator) {
      // Check if the current protocol is 'blob:' which prevents Service Worker registration
      if (window.location.protocol === 'blob:') {
        console.warn('Service Worker registration skipped: Not supported when running from a blob: URL (e.g., in this preview environment).');
        return;
      }

      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.log('Service Worker registered with scope:', registration.scope);
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
        });
    } else {
      console.warn('Service Workers are not supported in this browser.');
    }
  }, []);

  const handleAddExpense = async () => {
    if (!description || !amount || !date) {
      showCustomModal('Please fill in all fields (Description, Amount, Date).');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showCustomModal('Please enter a valid positive amount.');
      return;
    }

    if (!userId) {
      showCustomModal('User not authenticated. Cannot add expense.');
      return;
    }

    try {
      await addDoc(collection(db, `artifacts/${appId}/users/${userId}/expenses`), {
        description,
        amount: parsedAmount,
        date,
        timestamp: serverTimestamp(), // Use server timestamp for consistent ordering
        userId: userId // Store userId for security rules
      });
      setDescription('');
      setAmount('');
      setDate('');
    } catch (e) {
      console.error("Error adding document: ", e);
      showCustomModal("Error adding expense. Please try again.");
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!userId) {
      showCustomModal('User not authenticated. Cannot delete expense.');
      return;
    }
    try {
      await deleteDoc(collection(db, `artifacts/${appId}/users/${userId}/expenses`), id);
    } catch (e) {
      console.error("Error deleting document: ", e);
      showCustomModal("Error deleting expense. Please try again.");
    }
  };

  const handleFileInputChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      showCustomModal(`File selected: ${file.name}. Note: Advanced parsing of CSV/PDF is not implemented in this basic example.`);
      // You would add file parsing logic here (e.g., using PapaParse for CSV)
      // For a full implementation, you'd parse the file and then add expenses.
    }
  };

  const totalExpenses = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <div className="text-xl font-semibold">Loading Expense Tracker...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-inter flex flex-col items-center p-4 sm:p-6">
      <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sm:p-8 space-y-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-center text-blue-600 dark:text-blue-400 mb-6">
          Expense Tracker (Offline PWA)
        </h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md relative" role="alert">
            <strong className="font-bold">Error!</strong>
            <span className="block sm:inline"> {error}</span>
          </div>
        )}

        {userId && (
          <div className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
            User ID: <span className="font-mono break-all">{userId}</span>
          </div>
        )}

        {/* Input Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
          />
          <input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>
        <button
          onClick={handleAddExpense}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
        >
          Add Expense
        </button>

        {/* File Input */}
        <div className="mt-6">
          <label htmlFor="fileInput" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
            Upload Expenses (CSV/PDF) - *Basic functionality only*
          </label>
          <input
            type="file"
            id="fileInput"
            accept=".csv,.pdf"
            onChange={handleFileInputChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            (Note: This example only shows file selection. Full CSV/PDF parsing and data integration are complex and not implemented here.)
          </p>
        </div>

        {/* Dashboard */}
        <div id="dashboard" className="mt-8 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg shadow-inner">
          <h2 className="text-xl font-semibold text-blue-800 dark:text-blue-200">Dashboard</h2>
          <p className="text-lg text-blue-700 dark:text-blue-300 mt-2">
            Total Expenses: <span className="font-bold">₹{totalExpenses.toFixed(2)}</span>
          </p>
        </div>

        {/* Expense List */}
        <div className="mt-8">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Expense List</h2>
          {expenses.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center">No expenses added yet.</p>
          ) : (
            <ul className="space-y-3">
              {expenses.map((expense) => (
                <li
                  key={expense.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-gray-50 dark:bg-gray-700 p-4 rounded-lg shadow-sm"
                >
                  <div className="flex-1 mb-2 sm:mb-0">
                    <p className="text-lg font-medium text-gray-800 dark:text-gray-100">{expense.description}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {expense.date} - <span className="font-semibold">₹{expense.amount.toFixed(2)}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteExpense(expense.id)}
                    className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 text-sm"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Custom Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full text-center">
            <p className="text-gray-800 dark:text-gray-200 text-lg mb-4">{modalMessage}</p>
            <button
              onClick={() => setShowModal(false)}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
