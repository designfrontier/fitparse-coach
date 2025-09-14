const prisma = require("../lib/prisma");

const get = async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      id: user.id,
      firstname: user.firstname,
      lastname: user.lastname,
      ftp: user.ftp,
      hrmax: user.hrmax,
      isFastTwitch: user.isFastTwitch,
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { get };
