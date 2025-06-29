import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, Home, AlertCircle } from "lucide-react";

const NotFound = () => {
  const [counter, setCounter] = useState(10);

  useEffect(() => {
    const timer = counter > 0 && setInterval(() => setCounter(counter - 1), 1000);
    return () => clearInterval(timer);
  }, [counter]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 flex flex-col items-center justify-center p-6 text-white relative overflow-hidden">
      {/* Enhanced Animated Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 opacity-15">
          <div className="absolute top-10 -left-10 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-pulse"></div>
          <div className="absolute top-20 -right-10 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-pulse animation-delay-2000"></div>
          <div className="absolute -bottom-20 left-40 w-96 h-96 bg-cyan-500 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-pulse animation-delay-4000"></div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="relative z-10 max-w-4xl mx-auto text-center">
        {/* Logo with ERP Branding */}
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mb-8"
        >
          <div className="inline-block font-extrabold text-4xl text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
            Trade ERP
          </div>
        </motion.div>

        {/* Main Content Card */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="bg-gray-800/60 backdrop-blur-lg rounded-2xl p-10 border border-gray-700/40 shadow-2xl"
        >
          {/* Icon with Animation */}
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8, type: "spring" }}
            className="mx-auto mb-8 w-24 h-24 bg-blue-900/50 rounded-full flex items-center justify-center"
          >
            <AlertCircle size={48} className="text-cyan-300" />
          </motion.div>

          {/* 404 Text */}
          <motion.div
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
          >
            <h1 className="text-8xl font-extrabold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400">
              404
            </h1>
          </motion.div>

          {/* Message */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.8 }}
          >
            <h2 className="text-3xl font-semibold mb-4">Page Not Found</h2>
            <p className="text-lg text-gray-300 mb-10 max-w-2xl mx-auto">
              Oops! The page you're looking for doesn't exist in our Trade ERP system.
              <br />
              <span className="text-base text-cyan-200">
                Redirecting to the dashboard in <span className="text-white font-bold">{counter}</span> seconds.
              </span>
            </p>
          </motion.div>

          {/* Buttons */}
          <motion.div
            className="flex flex-wrap justify-center gap-6"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1, duration: 0.8 }}
          >
            <Link to="/">
              <motion.button
                whileHover={{ scale: 1.05, backgroundColor: "#3b82f6" }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-semibold transition-colors shadow-md"
              >
                <Home size={20} /> Back to Dashboard
              </motion.button>
            </Link>
            <Link to="/help-center">
              <motion.button
                whileHover={{ scale: 1.05, borderColor: "#60a5fa" }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-3 bg-transparent border-2 border-blue-600 text-blue-200 hover:text-blue-100 hover:border-blue-500 px-8 py-3 rounded-xl font-semibold transition-colors"
              >
                <ArrowLeft size={20} /> Get Help
              </motion.button>
            </Link>
          </motion.div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="mt-10 text-sm text-gray-400"
        >
          © {new Date().getFullYear()} Trade ERP. All rights reserved.
        </motion.div>
      </div>

      {/* Auto Redirect */}
      {counter === 0 && <meta httpEquiv="refresh" content="0;url=/" />}
    </div>
  );
};

export default NotFound;