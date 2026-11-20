const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const Otp = require('../models/Otp');
const auth = require('../middleware/auth');

function createToken(userId) {
    const secret = process.env.JWT_SECRET || 'finance_ai_super_secret_jwt_key_2025';
    return jwt.sign({ id: userId }, secret, { expiresIn: '7d' });
}

// Mailer Transporter
let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
}

// Send OTP Handler
const sendOtpHandler = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !email.includes('@')) {
            return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
        }

        const cleanEmail = email.trim().toLowerCase();

        // Check if email already registered
        const existing = await User.findOne({ $or: [{ email: cleanEmail }, { account: cleanEmail }] });
        if (existing) {
            return res.status(400).json({ success: false, message: 'This email is already registered. Please sign in.' });
        }

        // Generate 6-digit OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Remove any old OTPs for this email and save new one
        await Otp.deleteMany({ email: cleanEmail });
        await Otp.create({ email: cleanEmail, otp: otpCode });

        console.log(`\n========================================`);
        console.log(`📧 [FINANCE AI OTP CODE] for ${cleanEmail}: ${otpCode}`);
        console.log(`========================================\n`);

        // Send email if SMTP configured
        if (transporter) {
            try {
                await transporter.sendMail({
                    from: `"FinanceAI Verification" <${process.env.SMTP_USER}>`,
                    to: cleanEmail,
                    subject: `${otpCode} is your FinanceAI Registration Code`,
                    text: `Welcome to FinanceAI!\n\nYour 6-digit verification code is: ${otpCode}\n\nThis code will expire in 10 minutes.\n\nThank you,\nFinanceAI Team`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px;">
                            <h2 style="color: #1e3a8a; margin-top: 0;">🔐 FinanceAI Verification</h2>
                            <p style="color: #475569; font-size: 15px;">Use the 6-digit code below to verify your email and complete registration:</p>
                            <div style="background: #f1f5f9; padding: 18px; border-radius: 8px; text-align: center; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #2563eb; margin: 20px 0;">
                                ${otpCode}
                            </div>
                            <p style="color: #64748b; font-size: 13px;">This code will expire in 10 minutes. If you did not request this, please disregard this email.</p>
                        </div>
                    `
                });
            } catch (mailErr) {
                console.warn('⚠️ SMTP send warning:', mailErr.message);
            }
        }

        res.json({
            success: true,
            message: `OTP sent to ${cleanEmail}. Check your inbox (or console/screen preview).`,
            previewOtp: otpCode
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Register with OTP Handler
const registerWithOtpHandler = async (req, res) => {
    try {
        const { name, email, password, otp, job, annualIncome } = req.body;

        if (!email || !password || !otp) {
            return res.status(400).json({ success: false, message: 'Email, password, and OTP are required.' });
        }

        const cleanEmail = email.trim().toLowerCase();

        // Verify OTP
        const record = await Otp.findOne({ email: cleanEmail, otp: String(otp).trim() });
        if (!record) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP. Please request a new code.' });
        }

        // Check if user already exists
        const existing = await User.findOne({ $or: [{ email: cleanEmail }, { account: cleanEmail }] });
        if (existing) {
            return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
        }

        const accountName = cleanEmail.split('@')[0] + '_' + Math.floor(100 + Math.random() * 900);

        const user = new User({
            name: (name && String(name).trim()) || cleanEmail.split('@')[0],
            account: accountName,
            email: cleanEmail,
            password: String(password),
            job: job || 'salaried',
            annualIncome: Number(annualIncome) || 800000
        });

        await user.save();

        // Delete used OTP
        await Otp.deleteMany({ email: cleanEmail });

        const token = createToken(user._id);

        res.status(200).json({
            success: true,
            message: 'Account verified and registered successfully!',
            token,
            user: { id: user._id, name: user.name, email: user.email, account: user.account, job: user.job, annualIncome: user.annualIncome }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Login Handler (supports Email OR Account)
const loginHandler = async (req, res) => {
    try {
        const { email, account, password } = req.body;
        const identifier = (email || account || '').trim().toLowerCase();

        if (!identifier || !password) {
            return res.status(400).json({ success: false, message: 'Email/Account and password are required.' });
        }

        const user = await User.findOne({
            $or: [{ email: identifier }, { account: identifier }]
        }).select('+password');

        if (!user) {
            return res.status(401).json({ success: false, message: 'Account not found. Please register first.' });
        }

        const isMatch = await user.comparePassword(String(password));
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Incorrect password. Please try again.' });
        }

        const token = createToken(user._id);

        res.status(200).json({
            success: true,
            token,
            user: { id: user._id, name: user.name, email: user.email, account: user.account, job: user.job, annualIncome: user.annualIncome }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Legacy Register without OTP (fallback)
const registerHandler = async (req, res) => {
    try {
        const { name, account, email, password, job, annualIncome } = req.body;
        const identifier = (email || account || '').trim().toLowerCase();

        if (!identifier || !password) {
            return res.status(400).json({ success: false, message: 'Email/Account and password are required.' });
        }

        const existing = await User.findOne({ $or: [{ email: identifier }, { account: identifier }] });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Account already exists. Please sign in.' });
        }

        const user = new User({
            name: (name && String(name).trim()) || identifier.split('@')[0],
            account: identifier.includes('@') ? identifier.split('@')[0] : identifier,
            email: identifier.includes('@') ? identifier : `${identifier}@example.com`,
            password: String(password),
            job: job || 'salaried',
            annualIncome: Number(annualIncome) || 800000
        });

        await user.save();
        const token = createToken(user._id);

        res.status(200).json({
            success: true,
            msg: 'Registered successfully',
            token,
            user: { id: user._id, name: user.name, email: user.email, account: user.account, job: user.job, annualIncome: user.annualIncome }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Routes
router.post('/send-otp', sendOtpHandler);
router.post('/verify-register', registerWithOtpHandler);
router.post('/register', registerHandler);
router.post('/login', loginHandler);

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
    res.json({ success: true, user: req.user });
});

// PUT /api/auth/profile
router.put('/profile', auth, async (req, res) => {
    try {
        const { name, job, annualIncome } = req.body;
        if (name) req.user.name = name;
        if (job) req.user.job = job;
        if (annualIncome !== undefined) req.user.annualIncome = Number(annualIncome);

        await req.user.save();
        res.json({ success: true, user: req.user });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
module.exports.sendOtpHandler = sendOtpHandler;
module.exports.registerWithOtpHandler = registerWithOtpHandler;
module.exports.loginHandler = loginHandler;
module.exports.registerHandler = registerHandler;
