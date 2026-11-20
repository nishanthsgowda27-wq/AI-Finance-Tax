const mongoose = require('mongoose');

const connectDB = async () => {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/finance_ai';
    try {
        await mongoose.connect(uri);
        console.log(`✅ MongoDB Connected successfully to: ${mongoose.connection.host}/${mongoose.connection.name}`);
    } catch (err) {
        console.error('❌ MongoDB Connection Error:', err.message);
        console.warn('⚠️ Please ensure MongoDB service is running on 127.0.0.1:27017');
    }
};

module.exports = connectDB;
