const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

mongoose.connect(process.env.CONNECTION_URL, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log(err));

const User = require('./models/login');

const createUser = async () => {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin', salt);

    const user = new User({
        username: 'dummy@gmail.com',                                        
        password: hashedPassword
    });

    await user.save();
    console.log('User created');
    mongoose.connection.close();
};

createUser();
