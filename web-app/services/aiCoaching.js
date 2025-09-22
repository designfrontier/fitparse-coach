const axios = require("axios");

/**
 * AI Coaching Service
 * Abstraction layer for AI model interactions with support for multiple providers
 */
class AICoachingService {
  constructor(config = {}) {
    this.provider = config.provider || "openai";
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    this.model = config.model || "gpt-4-turbo-preview";
    this.maxTokens = config.maxTokens || 4096;
    this.temperature = config.temperature || 0.7;
    this.slidingWindowSize = config.slidingWindowSize || 10;
    this.conversationHistory = new Map(); // userId -> messages array
  }

  /**
   * Get or initialize conversation history for a user
   */
  getConversationHistory(userId) {
    if (!this.conversationHistory.has(userId)) {
      this.conversationHistory.set(userId, []);
    }
    return this.conversationHistory.get(userId);
  }

  /**
   * Build athlete context from user profile
   */
  buildAthleteContext(user) {
    const fastTwitchInfo = this.getFastTwitchDescription(user.isFastTwitch);

    return {
      role: "system",
      content: `You are an expert cycling coach providing personalized training guidance.

ATHLETE PROFILE:
- FTP: ${user.ftp}W
- Max Heart Rate: ${user.hrmax} bpm
- Muscle Fiber Type: ${fastTwitchInfo}
- Training Zones:
  * Z1 Recovery: <${Math.round(user.ftp * 0.55)}W
  * Z2 Endurance: ${Math.round(user.ftp * 0.55)}-${Math.round(user.ftp * 0.75)}W
  * Z3 Tempo: ${Math.round(user.ftp * 0.75)}-${Math.round(user.ftp * 0.9)}W
  * Z4 Threshold: ${Math.round(user.ftp * 0.9)}-${Math.round(user.ftp * 1.05)}W
  * Z5 VO2Max: ${Math.round(user.ftp * 1.05)}-${Math.round(user.ftp * 1.2)}W
  * Z6 Anaerobic: >${Math.round(user.ftp * 1.2)}W

COACHING GUIDELINES:
- Provide specific, actionable advice based on the training data
- Consider the athlete's muscle fiber type when recommending workout intensities and durations
- Fast-twitch athletes excel at short, high-intensity efforts but may need more recovery
- Slow-twitch athletes excel at longer, steady efforts and can handle higher training volume
- Always consider recent training load (TSS) when making recommendations
- Monitor HR drift as an indicator of aerobic fitness and fatigue
- Be encouraging but critical about training stress, training effectiveness, and recovery needs`,
    };
  }

  /**
   * Get fast twitch dominance description
   */
  getFastTwitchDescription(isFastTwitch) {
    if (isFastTwitch === true) {
      return "Fast-twitch dominant (explosive power, better at short high-intensity efforts)";
    } else if (isFastTwitch === false) {
      return "Slow-twitch dominant (endurance-oriented, better at sustained efforts)";
    }
    return "Unknown fiber type dominance";
  }

  /**
   * Manage conversation history with sliding window
   */
  manageConversationHistory(userId, newMessage, response) {
    const history = this.getConversationHistory(userId);

    // Add new exchange
    if (newMessage) {
      history.push({ role: "user", content: newMessage });
    }
    if (response) {
      history.push({ role: "assistant", content: response });
    }

    // Apply sliding window (keep system message + last N messages)
    if (history.length > this.slidingWindowSize) {
      const systemMessage = history.find((msg) => msg.role === "system");
      const recentMessages = history.slice(-this.slidingWindowSize);

      // Rebuild history with system message first
      const newHistory = systemMessage
        ? [systemMessage, ...recentMessages.filter((m) => m.role !== "system")]
        : recentMessages;
      this.conversationHistory.set(userId, newHistory);
    }
  }

  /**
   * Send message to AI coach
   */
  async sendCoachingMessage(user, message, trainingData = null) {
    try {
      const history = this.getConversationHistory(user.id);

      // Build context message
      const systemMessage = this.buildAthleteContext(user);

      // Add training data if provided
      let userMessage = message;
      if (trainingData) {
        userMessage = `${message}\n\nRecent Training Data:\n${JSON.stringify(
          trainingData,
          null,
          2
        )}`;
      }

      // Build messages array for API
      const messages = [
        systemMessage,
        ...history,
        { role: "user", content: userMessage },
      ];

      // Call the appropriate provider
      let response;
      switch (this.provider) {
        case "openai":
          response = await this.callOpenAI(messages);
          break;
        case "anthropic":
          response = await this.callAnthropic(messages);
          break;
        default:
          throw new Error(`Unsupported provider: ${this.provider}`);
      }

      // Update conversation history
      this.manageConversationHistory(user.id, userMessage, response);

      return response;
    } catch (error) {
      console.error("AI Coaching error:", error);
      throw error;
    }
  }

  /**
   * Call OpenAI API
   */
  async callOpenAI(messages) {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: this.model,
        messages: messages,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.choices[0].message.content;
  }

  /**
   * Call Anthropic API (Claude)
   */
  async callAnthropic(messages) {
    // Convert OpenAI format to Anthropic format
    const systemMessage = messages.find((m) => m.role === "system");
    const conversationMessages = messages.filter((m) => m.role !== "system");

    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: this.model,
        system: systemMessage?.content,
        messages: conversationMessages,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
      },
      {
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.content[0].text;
  }

  /**
   * Clear conversation history for a user
   */
  clearHistory(userId) {
    this.conversationHistory.delete(userId);
  }

  /**
   * Set sliding window size
   */
  setSlidingWindowSize(size) {
    this.slidingWindowSize = size;
  }

  /**
   * Switch AI provider
   */
  switchProvider(provider, apiKey, model) {
    this.provider = provider;
    if (apiKey) this.apiKey = apiKey;
    if (model) this.model = model;
  }
}

module.exports = AICoachingService;
