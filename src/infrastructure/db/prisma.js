// Single Prisma client for the whole app. Importing this module gives every
// caller the same connection pool (Prisma manages pooling internally).
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = { prisma };
