import express from 'express';
import UserProfile from '../models/UserProfile.js';
import Company from '../models/Company.js';

const router = express.Router();

router.post('/signup', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    
    const existingUser = await fetch(`${process.env.BETTER_AUTH_URL}/api/auth/user`, {
      headers: { 
        'Content-Type': 'application/json',
        'cookie': req.headers.cookie || ''
      }
    });

    res.redirect(`/api/auth/sign-up?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&name=${encodeURIComponent(name)}`);
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).render('error', { message: 'Registration failed. Please try again.' });
  }
});

router.post('/sign-up', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    
    res.redirect(307, `/api/auth/sign-up?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&name=${encodeURIComponent(name)}`);
  } catch (error) {
    console.error('Sign-up error:', error);
    res.status(500).render('error', { message: 'Sign up failed. Please try again.' });
  }
});

export default router;