// Data-access for web accounts (the `users` table). Thin Prisma wrappers, same
// style as asksRepository. Password hashing/compare lives in the route layer —
// this repo only ever stores and reads the already-hashed value.
const { prisma } = require('./prisma');

// email is expected pre-normalized (trim + lowercase) by the caller.
async function createUser({ email, passwordHash }) {
  return prisma.user.create({ data: { email, password_hash: passwordHash } });
}

async function findUserByEmail(email) {
  return prisma.user.findUnique({ where: { email } });
}

async function findUserById(id) {
  return prisma.user.findUnique({ where: { id } });
}

module.exports = { createUser, findUserByEmail, findUserById };
