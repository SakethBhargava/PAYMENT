const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const path = require('path');
const dotenv = require('dotenv');
const ejs = require('ejs');
const pdf = require('html-pdf');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const server = process.env.CONNECTION_URL;

if (!server) {
    console.error("Error: CONNECTION_URL environment variable is not set.");
    process.exit(1); // Exit the process with a failure code
}

mongoose.connect(server, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.set('view engine', 'ejs');

// Define Mongoose models and schemas (User, Payment)
const userSchema = new mongoose.Schema({
    name: String,
    vin: String,
    email: String,
    contact: String,
    paymentMethod: String,
    amount: Number
});
const User = mongoose.model('User', userSchema);

const paymentSchema = new mongoose.Schema({
    transactionId: String,
    date: Date,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});
const Payment = mongoose.model('Payment', paymentSchema);

const login = require('./models/login');

app.use(express.static('public')); // serve static files from public folder
app.use(express.urlencoded({ extended: true })); // parse form data

app.get('/',(req,res)=>{
    res.render('login.ejs');
})

app.get('/login', (req, res) => {
  res.render('login.ejs');
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await login.findOne({ username });
  if (!user) {
    res.status(401).send('Invalid username or password');
  } else {
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      res.status(401).send('Invalid username or password');
    } else {
      res.cookie('loggedIn', true, { httpOnly: true });
      res.redirect('/home');
    }
  }
});

app.get('/home', (req, res) => {
  if (!req.cookies.loggedIn) {
    res.redirect('/login');
  } else {
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
  }
});

app.get('/pay.ejs', (req, res) => {
  if (!req.cookies.loggedIn) {
    res.redirect('/login');
  } else {
    res.render('pay.ejs');
  }
});

// Route to handle payment form submission
app.post('/payment', async (req, res) => {
    try {
        const user = new User(req.body);
        await user.save();
        res.redirect(`/payment/${user._id}`);
    } catch (err) {
        console.error('Error saving user:', err);
        res.status(500).send('Server Error');
    }
});

// Route to serve payment page for a specific user
app.get('/payment/:userId', (req, res) => {
    const userId = req.params.userId;
    res.render('pay.ejs', { userId });
});

// Route to handle payment completion
app.post('/complete-payment', async (req, res) => {
    try {
        const { transactionId, date, userId } = req.body;
        const payment = new Payment({
            transactionId,
            date: new Date(date),
            userId
        });
        await payment.save();

        const user = await User.findById(userId);

        ejs.renderFile(path.join(__dirname, 'views', 'receipt.ejs'), { user, payment }, (err, html) => {
            if (err) {
                console.error('Error generating receipt HTML:', err);
                return res.status(500).send('Error generating receipt');
            }
            const options = { format: 'A4' };
            const filePath = path.join(__dirname, 'receipts', `${payment.transactionId}.pdf`);
            pdf.create(html, options).toFile(filePath, (err, result) => {
                if (err) {
                    console.error('Error generating PDF:', err);
                    return res.status(500).send('Error generating PDF');
                }
                res.render('download', { receiptPath: `/receipts/${payment.transactionId}.pdf` });
            });
        });
    } catch (err) {
        console.error('Error completing payment:', err);
        res.status(500).send('Server Error');
    }
});

// Static route to serve receipts
app.use('/receipts', express.static(path.join(__dirname, 'receipts')));

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});