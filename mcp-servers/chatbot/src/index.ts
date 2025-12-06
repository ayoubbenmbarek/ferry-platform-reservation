#!/usr/bin/env node

/**
 * Maritime Reservation Platform - Support Chatbot
 *
 * AI-powered chatbot that uses MCP to access:
 * - PostgreSQL database for booking/user lookups
 * - Ferryhopper API for route information (when available)
 * - FAQ knowledge base for common support questions
 */

import * as Sentry from "@sentry/node";
import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import cors from "cors";
import pg from "pg";

// Initialize Sentry before anything else
const SENTRY_DSN = process.env.SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.ENVIRONMENT || "development",
    release: `maritime-chatbot@${process.env.APP_VERSION || "1.0.0"}`,
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.1"),
    // Filter out sensitive data
    beforeSend(event) {
      // Remove sensitive headers
      if (event.request?.headers) {
        const sensitiveHeaders = ["authorization", "cookie", "x-api-key"];
        for (const header of sensitiveHeaders) {
          if (event.request.headers[header]) {
            event.request.headers[header] = "[FILTERED]";
          }
        }
      }
      return event;
    },
  });
  console.log(`Sentry initialized for chatbot in ${process.env.ENVIRONMENT || "development"}`);
} else {
  console.log("Sentry DSN not configured, error tracking disabled");
}

const { Pool } = pg;

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

// Database connection
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/maritime_reservations_dev",
  max: 5,
  idleTimeoutMillis: 30000,
});

// FAQ Knowledge Base
const FAQ_KNOWLEDGE = `
# Maritime Reservation Platform - FAQ Knowledge Base

## Booking Questions

### How do I make a booking?
1. Go to the homepage and search for your route
2. Select departure and return dates
3. Choose number of passengers and vehicles
4. Select your preferred ferry
5. Fill in passenger details
6. Choose cabin and meals (optional)
7. Complete payment

### How do I cancel my booking?
- You can cancel from your booking details page
- Click "Cancel Booking" button
- Cancellations made 7+ days before departure are eligible for refund
- Cancellation fees may apply based on operator policy

### How do I modify my booking?
- Go to My Bookings and select the booking
- Click "Modify Booking"
- You can change passenger names, vehicle details
- Date changes may incur additional fees

### Where is my confirmation email?
- Check your spam folder
- Emails are sent from noreply@maritime-reservations.com
- You can resend confirmation from booking details

### How do I get my e-ticket?
- E-tickets are attached to confirmation emails
- Download from booking details page
- QR code is required for check-in

## Payment Questions

### What payment methods are accepted?
- Credit/Debit cards (Visa, Mastercard)
- Apple Pay (Safari/iOS)
- Google Pay (Chrome/Android)

### Is my payment secure?
- All payments are processed through Stripe
- We don't store card details
- 256-bit SSL encryption

### When will I be charged?
- Payment is taken immediately upon booking
- Hold is released if booking fails

### How do I get a refund?
- Refunds are processed to original payment method
- Takes 5-10 business days to appear
- Amount depends on cancellation policy

## Account Questions

### How do I create an account?
- Click "Sign Up" or "Register"
- Enter email, name, and password
- Verify email address
- Or sign in with Google

### I forgot my password
- Click "Forgot Password" on login page
- Enter your email
- Check for reset link in email

### How do I update my profile?
- Go to My Account / Profile
- Update personal details
- Save changes

## Ferry & Route Questions

### What routes are available?
All routes are BIDIRECTIONAL (operate in both directions):
- Marseille ↔ Tunis (21h) - France to/from Tunisia
- Genoa ↔ Tunis (24h) - Italy to/from Tunisia
- Civitavecchia/Rome ↔ Tunis (22h) - Italy to/from Tunisia
- Palermo/Sicily ↔ Tunis (11h) - Italy to/from Tunisia
- Trapani ↔ Zarzis (8h) - Sicily to/from Southern Tunisia

You can travel FROM Tunisia TO Europe or FROM Europe TO Tunisia on all routes.

### What ferry operators are available?
- CTN (Compagnie Tunisienne de Navigation)
- GNV (Grandi Navi Veloci)
- Corsica Linea
- Grimaldi Lines

### Can I bring my vehicle?
- Yes, cars, motorcycles, campervans supported
- Enter vehicle details during booking
- Additional fees apply

### What cabin types are available?
- Inside cabin (no window)
- Outside cabin (with window)
- Suite (luxury)
- Reclining seat (deck passage)

## Price & Alerts

### How do price alerts work?
- Save a route to track prices
- Get notified when prices drop 5%+
- Set date range for tracking

### Why are prices different?
- Prices vary by date, demand, operator
- Book early for best prices
- Use flexible dates to find cheapest day

## Contact & Support

### How do I contact support?
- Email: support@maritime-reservations.com
- Use the chatbot (you're using it now!)

### What are your operating hours?
- 24/7 online booking
- Support available Mon-Fri 9am-6pm CET

### Where can I find operator policies?
- Each operator has different policies
- Check during booking process
- Contact operator directly for specifics
`;

// Tools for the chatbot
const tools: Anthropic.Tool[] = [
  {
    name: "lookup_booking",
    description:
      "Look up booking details by booking reference or email. Use this when user asks about their booking status, details, or has questions about a specific booking.",
    input_schema: {
      type: "object",
      properties: {
        booking_reference: {
          type: "string",
          description: "Booking reference code (e.g., MR1234ABCD)",
        },
        email: {
          type: "string",
          description: "Customer email address",
        },
      },
    },
  },
  {
    name: "search_routes",
    description:
      "Search for available ferry routes and pricing. Use this when user asks about routes, availability, or prices.",
    input_schema: {
      type: "object",
      properties: {
        departure_port: {
          type: "string",
          description: "Departure port (e.g., marseille, genoa, tunis)",
        },
        arrival_port: {
          type: "string",
          description: "Arrival port",
        },
        date: {
          type: "string",
          description: "Travel date (YYYY-MM-DD)",
        },
      },
      required: ["departure_port", "arrival_port"],
    },
  },
  {
    name: "get_user_bookings",
    description:
      "Get all bookings for a user by email. Use this to show booking history.",
    input_schema: {
      type: "object",
      properties: {
        email: {
          type: "string",
          description: "Customer email address",
        },
      },
      required: ["email"],
    },
  },
  {
    name: "get_price_alerts",
    description:
      "Get active price alerts for a user. Use when user asks about their saved routes or price tracking.",
    input_schema: {
      type: "object",
      properties: {
        email: {
          type: "string",
          description: "User email address",
        },
      },
      required: ["email"],
    },
  },
  {
    name: "get_faq_answer",
    description:
      "Search FAQ knowledge base for common questions. Use this for general support questions about how things work.",
    input_schema: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "The user's question or topic to search for",
        },
      },
      required: ["question"],
    },
  },
];

// Tool execution functions
async function executeTool(
  name: string,
  input: Record<string, unknown>,
  userContext?: UserContext
): Promise<string> {
  try {
    switch (name) {
      case "lookup_booking": {
        const { booking_reference, email } = input as {
          booking_reference?: string;
          email?: string;
        };

        if (!booking_reference && !email) {
          return "Please provide either a booking reference or email address.";
        }

        // SECURITY: If looking up by email, user must be authenticated and can only see their own bookings
        if (email && !booking_reference) {
          console.log(`[SECURITY] lookup_booking by email: ${email}`);
          console.log(`[SECURITY] User authenticated: ${userContext?.is_authenticated}`);

          if (!userContext?.is_authenticated) {
            console.log(`[SECURITY] BLOCKED - User not authenticated`);
            return "For security reasons, you must be logged in to view bookings by email. Please [Login](/login) first, or provide a specific booking reference number.";
          }
          if (userContext.email?.toLowerCase() !== email.toLowerCase()) {
            console.log(`[SECURITY] BLOCKED - Email mismatch: ${userContext.email} vs ${email}`);
            return "For security reasons, you can only view your own bookings. Please use your registered email address or provide a specific booking reference.";
          }
          console.log(`[SECURITY] ALLOWED - User verified`);
        }

        let whereClause = "";
        const params: string[] = [];

        if (booking_reference) {
          whereClause = "booking_reference = $1";
          params.push(booking_reference);
        } else if (email) {
          whereClause = "contact_email = $1";
          params.push(email);
        }

        const result = await pool.query(
          `
          SELECT
            booking_reference,
            status,
            departure_port,
            arrival_port,
            departure_time,
            return_departure_time as return_date,
            operator,
            total_amount as total_price,
            currency,
            total_passengers,
            contact_email,
            contact_first_name,
            contact_last_name,
            created_at
          FROM bookings
          WHERE ${whereClause}
          ORDER BY created_at DESC
          LIMIT 5
        `,
          params
        );

        if (result.rows.length === 0) {
          return "No booking found with the provided information.";
        }

        return JSON.stringify(result.rows, null, 2);
      }

      case "search_routes": {
        const { departure_port, arrival_port, date } = input as {
          departure_port: string;
          arrival_port: string;
          date?: string;
        };

        // Route information - bidirectional (same duration both ways)
        // In production, this would call the Ferryhopper MCP or real API
        const routeData: Record<string, { duration: string; operators: string[] }> = {
          "marseille-tunis": {
            duration: "21 hours",
            operators: ["CTN", "Corsica Linea"],
          },
          "genoa-tunis": {
            duration: "24 hours",
            operators: ["CTN", "GNV"],
          },
          "civitavecchia-tunis": {
            duration: "22 hours",
            operators: ["Grimaldi Lines"],
          },
          "palermo-tunis": {
            duration: "11 hours",
            operators: ["GNV"],
          },
          "trapani-zarzis": {
            duration: "8 hours",
            operators: ["GNV", "Liberty Lines"],
          },
        };

        // Normalize port names
        const normalizePort = (port: string): string => {
          const normalized = port.toLowerCase().trim();
          // Handle common variations
          if (normalized.includes("tunis") || normalized === "tunisia") return "tunis";
          if (normalized.includes("marseille")) return "marseille";
          if (normalized.includes("genoa") || normalized.includes("genova")) return "genoa";
          if (normalized.includes("civitavecchia") || normalized.includes("rome")) return "civitavecchia";
          if (normalized.includes("palermo")) return "palermo";
          if (normalized.includes("trapani") || normalized.includes("sicily")) return "trapani";
          if (normalized.includes("zarzis")) return "zarzis";
          return normalized;
        };

        const dep = normalizePort(departure_port);
        const arr = normalizePort(arrival_port);

        // Try both directions (routes are bidirectional)
        let routeKey = `${dep}-${arr}`;
        let route = routeData[routeKey];
        let isReverse = false;

        if (!route) {
          // Try reverse direction
          routeKey = `${arr}-${dep}`;
          route = routeData[routeKey];
          isReverse = true;
        }

        if (route) {
          return JSON.stringify({
            departure: departure_port,
            arrival: arrival_port,
            duration: route.duration,
            operators: route.operators,
            date: date || "Any date",
            bidirectional: true,
            note: "For current prices and availability, please use the search on our website.",
          });
        }

        // Provide helpful suggestions
        const availableRoutes = [
          "Marseille ↔ Tunis (21h)",
          "Genoa ↔ Tunis (24h)",
          "Civitavecchia/Rome ↔ Tunis (22h)",
          "Palermo ↔ Tunis (11h)",
          "Trapani ↔ Zarzis (8h)"
        ];

        return `Route from ${departure_port} to ${arrival_port} not found. Available bidirectional routes:\n${availableRoutes.join("\n")}\n\nAll routes operate in both directions (Europe ↔ Tunisia).`;
      }

      case "get_user_bookings": {
        const { email } = input as { email: string };

        console.log(`[SECURITY] get_user_bookings called for email: ${email}`);
        console.log(`[SECURITY] User authenticated: ${userContext?.is_authenticated}`);
        console.log(`[SECURITY] User context email: ${userContext?.email}`);

        // SECURITY: User must be authenticated and can only see their own bookings
        if (!userContext?.is_authenticated) {
          console.log(`[SECURITY] BLOCKED - User not authenticated`);
          return "For security reasons, you must be logged in to view your booking history. Please [Login](/login) first.";
        }
        if (userContext.email?.toLowerCase() !== email.toLowerCase()) {
          console.log(`[SECURITY] BLOCKED - Email mismatch: ${userContext.email} vs ${email}`);
          return "For security reasons, you can only view your own bookings. I can look up your bookings using your registered email address.";
        }
        console.log(`[SECURITY] ALLOWED - User verified`);

        const result = await pool.query(
          `
          SELECT
            booking_reference,
            status,
            departure_port,
            arrival_port,
            departure_time,
            total_amount as total_price,
            currency,
            created_at
          FROM bookings
          WHERE contact_email = $1
          ORDER BY created_at DESC
          LIMIT 10
        `,
          [email]
        );

        if (result.rows.length === 0) {
          return "No bookings found for this email address.";
        }

        return JSON.stringify(result.rows, null, 2);
      }

      case "get_price_alerts": {
        const { email } = input as { email: string };

        // SECURITY: User must be authenticated and can only see their own price alerts
        if (!userContext?.is_authenticated) {
          return "For security reasons, you must be logged in to view your price alerts. Please [Login](/login) first.";
        }
        if (userContext.email?.toLowerCase() !== email.toLowerCase()) {
          return "For security reasons, you can only view your own price alerts.";
        }

        const result = await pool.query(
          `
          SELECT
            departure_port,
            arrival_port,
            date_from,
            date_to,
            initial_price,
            current_price,
            lowest_price,
            status
          FROM price_alerts
          WHERE email = $1 AND status = 'active'
          ORDER BY created_at DESC
        `,
          [email]
        );

        if (result.rows.length === 0) {
          return "No active price alerts found for this email.";
        }

        return JSON.stringify(result.rows, null, 2);
      }

      case "get_faq_answer": {
        const { question } = input as { question: string };

        // Simple keyword matching for FAQ - in production, use embeddings
        const keywords = question.toLowerCase().split(" ");
        const relevantSections: string[] = [];

        const sections = FAQ_KNOWLEDGE.split("###").slice(1);

        for (const section of sections) {
          const sectionLower = section.toLowerCase();
          for (const keyword of keywords) {
            if (
              keyword.length > 3 &&
              sectionLower.includes(keyword)
            ) {
              relevantSections.push("###" + section.trim());
              break;
            }
          }
        }

        if (relevantSections.length > 0) {
          return relevantSections.slice(0, 3).join("\n\n");
        }

        return "I couldn't find a specific FAQ entry for that. Here are some common topics: booking, cancellation, payment, refund, account, routes, vehicles, cabins, price alerts.";
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (error) {
    console.error(`Tool execution error (${name}):`, error);
    // Capture tool execution errors in Sentry
    if (SENTRY_DSN) {
      Sentry.captureException(error, {
        tags: { service: "chatbot", tool: name },
        extra: { input },
      });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return `Error executing tool: ${message}`;
  }
}

// User context interface
interface UserContext {
  email?: string;
  first_name?: string;
  last_name?: string;
  is_authenticated: boolean;
}

// Platform links for reference
const PLATFORM_LINKS = {
  home: "/",
  search: "/search",
  login: "/login",
  register: "/register",
  myBookings: "/my-bookings",
  savedRoutes: "/saved-routes",
  profile: "/profile",
  findBooking: "/find-booking",
  contact: "/contact",
  about: "/about",
  forgotPassword: "/forgot-password",
};

// Generate booking link
function getBookingLink(bookingReference: string): string {
  return `/booking/${bookingReference}`;
}

// Generate search link with params
function getSearchLink(departure?: string, arrival?: string, date?: string): string {
  const params = new URLSearchParams();
  if (departure) params.append("from", departure);
  if (arrival) params.append("to", arrival);
  if (date) params.append("date", date);
  return `/search${params.toString() ? "?" + params.toString() : ""}`;
}

// Chat endpoint handler
async function handleChat(
  message: string,
  conversationHistory: Anthropic.MessageParam[] = [],
  userContext?: UserContext
): Promise<{ response: string; history: Anthropic.MessageParam[] }> {
  // Build context-aware system prompt
  const userInfo = userContext?.is_authenticated
    ? `
The current user is authenticated:
- Name: ${userContext.first_name} ${userContext.last_name}
- Email: ${userContext.email}

IMPORTANT: Since the user is authenticated, you can:
1. Automatically look up their bookings using their email (${userContext.email})
2. Check their price alerts
3. Provide personalized links to their bookings and saved routes
4. Address them by name (${userContext.first_name})

When they ask about "my bookings" or "my alerts", use their email automatically without asking.
`
    : `
The user is NOT authenticated. IMPORTANT SECURITY RULES:
1. NEVER look up bookings by email for unauthenticated users - this is a security violation
2. Only look up bookings by specific booking reference number (e.g., MR-XXXXXX)
3. If user asks to see bookings by email, tell them they must [Login](/login) first for security
4. Suggest they log in for a better experience: [Login](/login)
5. Never assume you know their identity
`;

  const systemPrompt = `You are a helpful customer support assistant for Maritime Reservation Platform, a ferry booking website for Tunisia routes.

${userInfo}

Your role is to:
1. Answer questions about bookings, routes, and the platform
2. Look up booking information when users provide references or emails
3. Explain how to use the platform features
4. Help with common issues (cancellations, modifications, payments)
5. Provide relevant links to help users navigate the platform

Guidelines:
- Be friendly, professional, and concise
- Use the tools available to look up actual data when needed
- If you can't find information, suggest contacting support
- Don't make up information - use the FAQ or database lookups
- Protect user privacy - only show user data to authenticated users with matching email
- For complex issues, recommend contacting support@maritime-reservations.com

IMPORTANT - Include relevant links in your responses:
- When discussing bookings: Include link to booking details page using format: [View Booking](/booking/REFERENCE)
- When suggesting to search routes: [Search Ferries](/search) or [Search Marseille to Tunis](/search?from=marseille&to=tunis)
- When user needs to log in: [Login](/login) or [Register](/register)
- When discussing saved routes/alerts: [My Saved Routes](/saved-routes)
- When discussing booking history: [My Bookings](/my-bookings)
- When user asks how to find booking: [Find Booking](/find-booking)
- When discussing profile/account: [My Profile](/profile)
- For contact/support: [Contact Us](/contact)

Available BIDIRECTIONAL routes (both directions - Europe ↔ Tunisia):
- Marseille ↔ Tunis (21h) via CTN, Corsica Linea
- Genoa ↔ Tunis (24h) via CTN, GNV
- Civitavecchia/Rome ↔ Tunis (22h) via Grimaldi Lines
- Palermo/Sicily ↔ Tunis (11h) via GNV
- Trapani ↔ Zarzis (8h) via GNV, Liberty Lines

Users can travel FROM Tunisia TO Europe (e.g., Tunis to Marseille) or FROM Europe TO Tunisia.`;

  // Add user message to history
  const updatedHistory: Anthropic.MessageParam[] = [
    ...conversationHistory,
    { role: "user", content: message },
  ];

  // Initial API call
  let response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: systemPrompt,
    tools,
    messages: updatedHistory,
  });

  // Process tool calls
  while (response.stop_reason === "tool_use") {
    const assistantMessage: Anthropic.MessageParam = {
      role: "assistant",
      content: response.content,
    };
    updatedHistory.push(assistantMessage);

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === "tool_use") {
        const result = await executeTool(
          block.name,
          block.input as Record<string, unknown>,
          userContext
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }
    }

    updatedHistory.push({
      role: "user",
      content: toolResults,
    });

    response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      tools,
      messages: updatedHistory,
    });
  }

  // Extract text response
  let textResponse = "";
  for (const block of response.content) {
    if (block.type === "text") {
      textResponse += block.text;
    }
  }

  // Add assistant response to history
  updatedHistory.push({
    role: "assistant",
    content: response.content,
  });

  return {
    response: textResponse,
    history: updatedHistory,
  };
}

// Express server setup
const app = express();
app.use(cors());
app.use(express.json());

// Store conversation histories (in production, use Redis or database)
const conversations = new Map<string, Anthropic.MessageParam[]>();

// Store user contexts per session
const userContexts = new Map<string, UserContext>();

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { message, session_id, user_context } = req.body;

    console.log(`[CHAT] Received message: "${message.substring(0, 100)}..."`);
    console.log(`[CHAT] User authenticated: ${user_context?.is_authenticated || false}`);
    if (user_context?.is_authenticated) {
      console.log(`[CHAT] User email: ${user_context.email}`);
    }

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const sessionId = session_id || `session_${Date.now()}`;
    const history = conversations.get(sessionId) || [];

    // Store or update user context for this session
    if (user_context) {
      userContexts.set(sessionId, user_context);
    }
    const currentUserContext = userContexts.get(sessionId);

    const result = await handleChat(message, history, currentUserContext);

    // Store updated history (limit to last 20 messages)
    conversations.set(
      sessionId,
      result.history.slice(-20)
    );

    res.json({
      response: result.response,
      session_id: sessionId,
    });
  } catch (error) {
    console.error("Chat error:", error);
    // Capture error in Sentry
    if (SENTRY_DSN) {
      Sentry.captureException(error, {
        tags: { service: "chatbot", endpoint: "/api/chat" },
      });
    }
    res.status(500).json({
      error: "Failed to process message",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "maritime-chatbot" });
});

// Test Sentry error (only in development)
app.get("/test-sentry", (req, res) => {
  if (process.env.ENVIRONMENT === "production") {
    return res.status(403).json({ error: "Not allowed in production" });
  }
  const testError = new Error("Test error from maritime-chatbot for Sentry verification");
  console.error("Triggering test error for Sentry:", testError.message);
  if (SENTRY_DSN) {
    Sentry.captureException(testError, {
      tags: { service: "chatbot", test: "true" },
    });
    res.json({ success: true, message: "Test error sent to Sentry" });
  } else {
    res.json({ success: false, message: "Sentry DSN not configured" });
  }
});

// Clear conversation
app.post("/api/chat/clear", (req, res) => {
  const { session_id } = req.body;
  if (session_id) {
    conversations.delete(session_id);
    userContexts.delete(session_id);
  }
  res.json({ success: true });
});

// Start server
const PORT = process.env.PORT || 3100;
app.listen(PORT, () => {
  console.log(`Maritime Chatbot running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Chat endpoint: POST http://localhost:${PORT}/api/chat`);
});
