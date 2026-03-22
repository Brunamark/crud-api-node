const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/database');

class User {
    constructor(data) {
        this.id = data.id;
        this.email = data.email;
        this.username = data.username;
        this.password = data.password;
        this.firstName = data.firstName;
        this.lastName = data.lastName;
        this.createdAt = data.createdAt;
    }

    async hashPassword() {
        this.password = await bcrypt.hash(this.password, 12);
    }

    async comparePassword(candidatePassword) {
        return bcrypt.compare(candidatePassword, this.password);
    }

    generateToken() {
        return jwt.sign(
            { id: this.id, email: this.email, username: this.username },
            config.jwtSecret,
            { expiresIn: config.jwtExpiration }
        );
    }

    validate() {
        const errors = [];
        if (!this.email?.trim()) errors.push('Email é obrigatório');
        if (!this.username?.trim()) errors.push('Username é obrigatório');
        if (!this.password) errors.push('Password é obrigatório');
        return { isValid: errors.length === 0, errors };
    }
    toJSON() {
        const { password, ...user } = this;
        return user;
    }
}

module.exports = User;
