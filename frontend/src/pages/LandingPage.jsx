
import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Car, Shield, Clock, MapPin, Users, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LandingPage = () => {
  return (
    <div className="min-h-screen">
      <Helmet>
        <title>AutoCare Pro - Premium Car Management System</title>
        <meta name="description" content="Professional car management and service system with real-time tracking, automated reminders, and comprehensive admin controls." />
      </Helmet>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-red-900/20 to-black"></div>
        
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="relative z-10 text-center px-4 max-w-6xl mx-auto"
        >
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="text-6xl md:text-8xl font-bold mb-6 gradient-text"
          >
            AutoCare Pro
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto"
          >
            Premium Car Management Information System with Real-Time Tracking, 
            Automated Service Reminders, and Professional Admin Controls
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link to="/register">
              <Button className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-8 py-3 text-lg red-glow">
                Get Started
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white px-8 py-3 text-lg">
                Sign In
              </Button>
            </Link>
          </motion.div>
        </motion.div>

        {/* Floating Car Image */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5, delay: 0.8 }}
          className="absolute bottom-10 right-10 hidden lg:block"
        >
          <img  alt="Luxury sports car" className="w-96 h-auto opacity-80" src="https://images.unsplash.com/photo-1681757919215-dce9022de95d" />
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6 gradient-text">
              Premium Features
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Experience the future of car management with our comprehensive suite of professional tools
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: <Car className="w-8 h-8" />,
                title: "Service Management",
                description: "Request brake repairs, routine maintenance, and specialized services with ease"
              },
              {
                icon: <MapPin className="w-8 h-8" />,
                title: "Real-Time Tracking",
                description: "Track your vehicle pickup with live GPS monitoring and estimated arrival times"
              },
              {
                icon: <Clock className="w-8 h-8" />,
                title: "Smart Reminders",
                description: "Automated service reminders based on your vehicle's maintenance schedule"
              },
              {
                icon: <Shield className="w-8 h-8" />,
                title: "Admin Controls",
                description: "Comprehensive admin dashboard for request management and approval workflows"
              },
              {
                icon: <Users className="w-8 h-8" />,
                title: "Expert Team",
                description: "Professional service from certified technicians Emmanuel, Joel, Ibrahim, and Patience"
              },
              {
                icon: <Wrench className="w-8 h-8" />,
                title: "Spare Parts",
                description: "Intelligent spare parts recommendations based on your service requests"
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="service-card p-6 rounded-xl card-hover"
              >
                <div className="text-red-500 mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-3 text-white">{feature.title}</h3>
                <p className="text-gray-300">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto text-center glass-effect p-12 rounded-2xl red-glow"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6 gradient-text">
            Ready to Transform Your Car Care?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Join thousands of satisfied customers who trust AutoCare Pro for their vehicle management needs
          </p>
          <Link to="/register">
            <Button className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-12 py-4 text-xl red-glow">
              Start Your Journey
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-red-900/30">
        <div className="max-w-6xl mx-auto text-center">
          <span className="text-2xl font-bold gradient-text">AutoCare Pro</span>
          <p className="text-gray-400 mt-4">
            © 2025 AutoCare Pro. Premium Car Management System.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
