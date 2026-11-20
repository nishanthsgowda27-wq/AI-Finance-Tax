const express = require('express');
const router = express.Router();
const loanEngine = require('../services/loanEngine');

const VEHICLE_CATALOG = {
    cars: [
        { model: 'Tata Punch', category: 'Compact SUV', exShowroom: 613000, img: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2' },
        { model: 'Maruti Swift', category: 'Hatchback', exShowroom: 649000, img: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341' },
        { model: 'Hyundai Creta', category: 'Mid-size SUV', exShowroom: 1100000, img: 'https://images.unsplash.com/photo-1617814065893-9c6d48d9f1e3' },
        { model: 'Tata Nexon EV', category: 'Electric SUV', exShowroom: 1450000, img: 'https://images.unsplash.com/photo-1563720223185-11003d516935' }
    ],
    bikes: [
        { model: 'Hero Splendor Plus', category: 'Commuter', exShowroom: 75400, img: 'https://images.unsplash.com/photo-1580310614729-ccd69652491d' },
        { model: 'TVS Apache RTR 160', category: 'Sports', exShowroom: 120000, img: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87' },
        { model: 'Royal Enfield Classic 350', category: 'Cruiser', exShowroom: 193000, img: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39' }
    ]
};

// POST /api/vehicle/calculate
router.post('/calculate', (req, res) => {
    try {
        const vehiclePrice = Number(req.body.vehiclePrice) || 800000;
        const downPayment = Number(req.body.downPayment) || 160000;
        const interestRate = Number(req.body.interestRate) || 9.5;
        const tenureMonths = Number(req.body.tenureMonths) || 60;
        const monthlyIncome = Number(req.body.monthlyIncome) || 0;

        const loanAmount = Math.max(0, vehiclePrice - downPayment);
        const emi = loanEngine.calculateEMI(loanAmount, interestRate, tenureMonths);
        const totalPayment = emi * tenureMonths;
        const totalInterest = Math.max(0, totalPayment - loanAmount);
        const totalCost = downPayment + totalPayment;

        const downPaymentRatio = vehiclePrice > 0 ? Number(((downPayment / vehiclePrice) * 100).toFixed(1)) : 0;
        const emiToIncomeRatio = monthlyIncome > 0 ? Number(((emi / monthlyIncome) * 100).toFixed(1)) : 0;

        let affordability = 'Affordable';
        if (monthlyIncome > 0 && emiToIncomeRatio > 25) {
            affordability = 'High Financial Burden (EMI exceeds 25% of income)';
        } else if (monthlyIncome > 0 && emiToIncomeRatio > 15) {
            affordability = 'Moderate Burden (Keep buffer for fuel & maintenance)';
        }

        res.json({
            success: true,
            vehiclePrice,
            downPayment,
            downPaymentRatio,
            loanAmount,
            interestRate,
            tenureMonths,
            emi,
            totalInterest,
            totalPayment,
            totalCost,
            emiToIncomeRatio,
            affordability,
            catalog: VEHICLE_CATALOG
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/vehicle/catalog
router.get('/catalog', (req, res) => {
    res.json({ success: true, catalog: VEHICLE_CATALOG });
});

module.exports = router;
