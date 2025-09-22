const prisma = require("../lib/prisma");

// Get all AI analyses for the current user
const get = async (req, res) => {
  try {
    const analyses = await prisma.aIAnalysis.findMany({
      where: { userId: req.session.userId },
      orderBy: { weekStartDate: "desc" },
      take: req.query.limit ? parseInt(req.query.limit) : undefined,
    });
    res.json(analyses);
  } catch (error) {
    console.error("Error fetching AI analyses:", error);
    res.status(500).json({ error: "Failed to fetch AI analyses" });
  }
};

// Get the most recent AI analysis for the current user
const getLatest = async (req, res) => {
  try {
    const analysis = await prisma.aIAnalysis.findFirst({
      where: { userId: req.session.userId },
      orderBy: { weekStartDate: "desc" },
    });
    res.json(analysis || null);
  } catch (error) {
    console.error("Error fetching latest AI analysis:", error);
    res.status(500).json({ error: "Failed to fetch latest AI analysis" });
  }
};

// Get a specific AI analysis by ID
const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const analysis = await prisma.aIAnalysis.findFirst({
      where: {
        id: parseInt(id),
        userId: req.session.userId,
      },
    });

    if (!analysis) {
      return res.status(404).json({ error: "Analysis not found" });
    }

    res.json(analysis);
  } catch (error) {
    console.error("Error fetching AI analysis by ID:", error);
    res.status(500).json({ error: "Failed to fetch AI analysis" });
  }
};

// Save a new AI analysis
const post = async (req, res) => {
  try {
    const { weekStartDate, weekEndDate, weekData, aiResponse } = req.body;

    if (!weekStartDate || !weekEndDate || !weekData || !aiResponse) {
      return res.status(400).json({
        error: "Missing required fields: weekStartDate, weekEndDate, weekData, aiResponse"
      });
    }

    // Check if an analysis already exists for this week
    const existing = await prisma.aIAnalysis.findFirst({
      where: {
        userId: req.session.userId,
        weekStartDate: new Date(weekStartDate),
        weekEndDate: new Date(weekEndDate),
      },
    });

    let analysis;
    if (existing) {
      // Update existing analysis
      analysis = await prisma.aIAnalysis.update({
        where: { id: existing.id },
        data: {
          weekData: typeof weekData === "object" ? JSON.stringify(weekData) : weekData,
          aiResponse,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new analysis
      analysis = await prisma.aIAnalysis.create({
        data: {
          userId: req.session.userId,
          weekStartDate: new Date(weekStartDate),
          weekEndDate: new Date(weekEndDate),
          weekData: typeof weekData === "object" ? JSON.stringify(weekData) : weekData,
          aiResponse,
        },
      });
    }

    res.json(analysis);
  } catch (error) {
    console.error("Error saving AI analysis:", error);
    res.status(500).json({ error: "Failed to save AI analysis" });
  }
};

// Delete an AI analysis
const deleteAnalysis = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify the analysis belongs to the current user
    const analysis = await prisma.aIAnalysis.findFirst({
      where: {
        id: parseInt(id),
        userId: req.session.userId,
      },
    });

    if (!analysis) {
      return res.status(404).json({ error: "Analysis not found" });
    }

    await prisma.aIAnalysis.delete({
      where: { id: parseInt(id) },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting AI analysis:", error);
    res.status(500).json({ error: "Failed to delete AI analysis" });
  }
};

module.exports = { get, getLatest, getById, post, delete: deleteAnalysis };