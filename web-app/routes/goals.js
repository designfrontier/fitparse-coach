const prisma = require("../lib/prisma");

const get = async (req, res) => {
  try {
    const goals = await prisma.goal.findMany({
      where: { userId: req.session.userId },
      orderBy: { createdAt: "desc" },
    });
    res.json(goals);
  } catch (error) {
    console.error("Error fetching goals:", error);
    res.status(500).json({ error: "Failed to fetch goals" });
  }
};

const post = async (req, res) => {
  try {
    const goal = await prisma.goal.create({
      data: {
        ...req.body,
        userId: req.session.userId,
      },
    });
    res.json(goal);
  } catch (error) {
    console.error("Error saving goal:", error);
    res.status(500).json({ error: "Failed to save goal" });
  }
};

module.exports = { get, post };
