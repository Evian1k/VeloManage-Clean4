import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Lock, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

const SettingsPage = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.password && formData.password !== formData.confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Please ensure your new passwords match.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    updateUser({ name: formData.name, email: formData.email });
    setTimeout(() => {
      setLoading(false);
      toast({
        title: "Settings Updated",
        description: "Your profile information has been successfully updated.",
      });
      if (formData.password) {
        setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
      }
    }, 1000);
  };

  return (
    <div className="min-h-screen p-4">
      <Helmet>
        <title>Settings - AutoCare Pro</title>
        <meta name="description" content="Manage your account settings and profile information." />
      </Helmet>

      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-4 mb-8"
        >
          <Button
            variant="outline"
            onClick={() => navigate('/dashboard')}
            className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold gradient-text">Settings</h1>
            <p className="text-gray-300">Manage your account and preferences</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <form onSubmit={handleSubmit}>
            <Card className="glass-effect border-red-900/30">
              <CardHeader>
                <CardTitle className="text-white">Profile Information</CardTitle>
                <CardDescription className="text-gray-300">Update your personal details here.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-white">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input id="name" name="name" value={formData.name} onChange={handleChange} className="pl-10 bg-black/50 border-red-900/50 text-white" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} className="pl-10 bg-black/50 border-red-900/50 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-effect border-red-900/30 mt-6">
              <CardHeader>
                <CardTitle className="text-white">Change Password</CardTitle>
                <CardDescription className="text-gray-300">Leave blank to keep your current password.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="password"  className="text-white">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input id="password" name="password" type="password" value={formData.password} onChange={handleChange} className="pl-10 bg-black/50 border-red-900/50 text-white" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword"  className="text-white">Confirm New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input id="confirmPassword" name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} className="pl-10 bg-black/50 border-red-900/50 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="mt-8 flex justify-end">
              <Button type="submit" disabled={loading} className="bg-gradient-to-r from-red-600 to-red-700 text-white">
                <Save className="w-4 h-4 mr-2" />
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default SettingsPage;